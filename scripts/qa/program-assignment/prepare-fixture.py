"""Prepara 8/9 por API real y reserva el último submit para el e2e 4.11 de front."""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import secrets
import uuid

APP = Path(__file__).resolve().parents[3]
WORKSPACE = APP.parents[1]
OPS = WORKSPACE / '.ai/operations/organizar-experiencia-bienestar'

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

h = module('qa_shared', OPS / '3.20-fixture-helper.py')

def protected_digest(cursor):
    """Solo sentinelas protegidos: nuevos pacientes no deben contaminar la comparación."""
    ids = ['0c487f75-a462-4fda-894d-61c031441884', 'ef59c692-d01a-4105-b3ea-05c07ff76279']
    queries = {
        'intakes': 'SELECT t.* FROM app.nutrition_intake_logs t WHERE patient_id=ANY(%s::uuid[])',
        'publishedReviews': 'SELECT t.* FROM app.nutrition_cycle_reviews t JOIN app.nutrition_cycles c ON c.id=t.cycle_id WHERE c.patient_id=ANY(%s::uuid[]) AND t.published_at IS NOT NULL',
        'publishedPlans': 'SELECT t.* FROM app.nutrition_prescriptions t WHERE patient_id=ANY(%s::uuid[]) AND is_published=true',
    }
    result = {}
    for key, query in queries.items():
        cursor.execute("SELECT count(*),md5(coalesce(string_agg(to_jsonb(p)::text,'' ORDER BY id),'')) FROM (" + query + ') p', (ids,))
        count, digest = cursor.fetchone()
        result[key] = {'count':count,'digest':digest}
    return result

def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def state(patient_id):
    with h.connect() as db:
        with db.cursor() as c:
            c.execute('SELECT count(*) FROM app.program_enrollments WHERE patient_id=%s', (patient_id,))
            enrollments = c.fetchone()[0]
            c.execute('SELECT count(*) FROM app.program_assignment_recommendations WHERE patient_id=%s', (patient_id,))
            recommendations = c.fetchone()[0]
            c.execute('SELECT count(*) FROM app.health_test_evaluations WHERE patient_id=%s AND status=\'completed\'', (patient_id,))
            evaluations = c.fetchone()[0]
            protected = protected_digest(c)
    return {'enrollments': enrollments, 'recommendations': recommendations, 'completedEvaluations': evaluations, 'protected': protected}

def answers_for(detail):
    answers, choices = [], []
    for q in detail['questions']:
        if q['type'] == 'num':
            value = {'peso': 100, 'talla': 165}.get(q['code'], q.get('defaultValue') if q.get('defaultValue') is not None else q.get('minValue') if q.get('minValue') is not None else 1)
            if q.get('minValue') is not None: value = max(value, q['minValue'])
            if q.get('maxValue') is not None: value = min(value, q['maxValue'])
            answers.append({'questionId': q['id'], 'answerOptionId': None, 'valueText': str(value)})
        elif q['type'] == 'open':
            answers.append({'questionId': q['id'], 'answerOptionId': None, 'valueText': 'Respuesta sintetica de QA411, sin datos personales reales.'})
        else:
            options = [o for o in q['options'] if o.get('isActive', True)]
            assert options, 'Pregunta sin opciones: revisar catalogo antes de escribir'
            # Mismo criterio sintético de ProgramAssignmentIntegrationTests; no es consejo clínico.
            option = min(options, key=lambda o: (o.get('scoreValue') if o.get('scoreValue') is not None else 0, o['sortOrder']))
            answers.append({'questionId': q['id'], 'answerOptionId': option['id'], 'valueText': None})
            choices.append({'questionId': q['id'], 'code': q['code'], 'type': q['type'], 'optionId': option['id'], 'optionText': option['text'], 'optionIndex': q['options'].index(option)})
    return answers, choices

def prepare(path):
    if path.exists():
        value = json.loads(path.read_text(encoding='utf-8'))
    else:
        run = '20261115-' + uuid.uuid4().hex[:8]
        login = f'qa411-{run}-patient@qa.coppaddresd.test'
        target = f'CoppAddresd/QA/4.11/{run}/patient'
        h.write_credential(target, login, 'Qa!9' + secrets.token_urlsafe(28))
        value = {'run': run, 'owner': 'codex-app', 'status': 'preparing', 'authBaseUrl': h.AUTH, 'apiBaseUrl': h.API,
                 'patientId': str(uuid.uuid4()), 'timezone': 'America/Bogota', 'accounts': {'patient': {'login': login, 'application': 'app', 'credentialTarget': target, 'documentNumber': '411' + str(secrets.randbelow(10**10)).zfill(10)}}, 'submissions': []}
        save(path, value)
    assert value['owner'] == 'codex-app' and value['accounts']['patient']['credentialTarget'].startswith('CoppAddresd/QA/4.11/')
    assert value['patientId'] not in ['0c487f75-a462-4fda-894d-61c031441884', 'ef59c692-d01a-4105-b3ea-05c07ff76279']
    account = value['accounts']['patient']
    if not account.get('userId'):
        cred = h.read_credential(account['credentialTarget'])
        user = h.request('POST', h.AUTH + '/api/auth/users', {'email': cred['login'], 'password': cred['password'], 'firstName': 'QA411', 'lastName': value['run']})
        account['userId'] = user['id']; save(path, value)
    if not value.get('profilePrepared'):
        with h.connect() as db:
            with db.cursor() as c:
                value['protectedBefore'] = protected_digest(c)
                c.execute('INSERT INTO auth."UserApplications"("UserId","ApplicationId","CreatedAt","IsSuspended","SessionVersion") SELECT %s,"Id",now(),false,0 FROM auth."Applications" WHERE "Code"=\'app\' ON CONFLICT DO NOTHING', (account['userId'],))
                c.execute("INSERT INTO app.patient_profiles(id,user_id,first_name,last_name,status,timezone,document_number,email,date_of_birth,gender,league_opt_in) VALUES(%s,%s,'QA411',%s,'Activo','America/Bogota',%s,%s,DATE '1986-01-01','Femenino',false)", (value['patientId'], account['userId'], value['run'], account['documentNumber'], account['login']))
        value['profilePrepared'] = True; save(path, value)
    initial = state(value['patientId'])
    assert initial['enrollments'] == 0 and initial['recommendations'] == 0, 'Fixture ya consumida: no resetear'
    token = h.login(account)['accessToken']
    assignments = h.request('GET', h.API + '/api/v1/health-tests/me/assignments?scope=initial', token=token)
    assert len(assignments) == 9 and all(a['isRequired'] and a['batteryRequiredCount'] == 9 for a in assignments)
    assert len({a['batteryAssignmentId'] for a in assignments}) == 1
    final = next(a for a in assignments if a['testCode'] == 'ers')
    value['batteryAssignmentId'] = final['batteryAssignmentId']
    for assignment in assignments:
        detail = h.request('GET', h.API + '/api/v1/health-tests/me/tests/' + assignment['id'], token=token)
        answers, choices = answers_for(detail)
        payload = {'answers': answers, 'clientRequestId': 'qa411-' + assignment['id']}
        if assignment['id'] == final['id']:
            assert assignment['status'] == 'pending', 'No anticipar ni repetir el noveno test'
            value['lastTest'] = {'assignmentId': assignment['id'], 'versionId': assignment['versionId'], 'testCode': assignment['testCode'], 'testName': assignment['testName'], 'questions': detail['questions'], 'choices': choices, 'submitPayload': payload}
            save(path, value)
            continue
        if assignment['status'] != 'completed':
            h.request('POST', h.API + '/api/v1/health-tests/me/tests/' + assignment['id'] + '/start', token=token)
            submitted = h.request('POST', h.API + '/api/v1/health-tests/me/tests/' + assignment['id'] + '/submit', payload, token=token)
            assert submitted['status'] == 'completed'
            value['submissions'].append({'assignmentId': assignment['id'], 'testCode': assignment['testCode'], 'evaluationId': submitted['id'], 'status': submitted['status']})
            save(path, value)
        current = state(value['patientId'])
        assert current['enrollments'] == 0 and current['recommendations'] == 0
    listed = h.request('GET', h.API + '/api/v1/health-tests/me/assignments?scope=initial', token=token)
    assert len([a for a in listed if a['status'] == 'completed']) == 8
    assert next(a for a in listed if a['id'] == final['id'])['status'] == 'pending'
    current = state(value['patientId'])
    assert current['completedEvaluations'] == 8 and current['enrollments'] == 0 and current['recommendations'] == 0
    assert current['protected'] == value['protectedBefore'], 'Sentinelas protegidos cambiaron'
    value.update(status='ready-8-of-9', preparedAt=dt.datetime.now(dt.timezone.utc).isoformat(), assignments=listed, preflight=current,
                 acceptance={'afterLastSubmit':'PendingAssignment + proposal', 'immediateActive':False, 'automaticFallbackDays':7, 'ninthSubmitted':False, 'erpApplyPerformed':False})
    save(path, value)
    print(json.dumps({'status': value['status'], 'metadata': str(path), 'patientId': value['patientId'], 'completedTests': 8, 'lastTestCode': final['testCode'], 'lastTestStatus': 'pending', 'enrollments': 0, 'recommendations': 0, 'protectedUnchanged': True}))

def check(path):
    value = json.loads(path.read_text(encoding='utf-8'))
    current = state(value['patientId'])
    assert current['protected'] == value['protectedBefore']
    output = {'patientId':value['patientId'], 'stage':value['status'], 'state':current}
    if value.get('aiPatient', {}).get('enrollmentId'):
        with h.connect() as db:
            with db.cursor() as c:
                c.execute('SELECT to_jsonb(w) FROM app.program_weeks w WHERE enrollment_id=%s AND week_number=2',(value['aiPatient']['enrollmentId'],))
                week=c.fetchone()[0]
                digest=hashlib.sha256(json.dumps(week,sort_keys=True,separators=(',',':')).encode()).hexdigest()
                c.execute("SELECT count(*) FROM audit.activity_logs WHERE record_id::text IN (%s,%s) AND coalesce(metadata::text,'') LIKE %s",(str(week['id']),value['aiPatient']['enrollmentId'],'%"ai_application"%'))
                applied_audits=c.fetchone()[0]
                c.execute("SELECT state,count(*) FROM app.patient_ai_briefs WHERE patient_id=%s AND kind='weekly_plan_suggestions' GROUP BY state",(value['aiPatient']['patientId'],))
                drafts={state:count for state,count in c.fetchall()}
        output['aiPatient']={'patientId':value['aiPatient']['patientId'],'enrollmentId':value['aiPatient']['enrollmentId'],'weekNumber':2,'weekSha256':digest,'weekEqualsBaseline':week==value['aiPatient']['weekBefore'],'aiApplicationAuditCount':applied_audits,'weeklyBriefStates':drafts}
    print(json.dumps(output))

def prepare_ai(path):
    """Compañero activo para 4.8; nunca se usa como prueba de alta post-tests."""
    value = json.loads(path.read_text(encoding='utf-8'))
    assert state(value['patientId'])['enrollments'] == 0, 'Paciente de tests ya consumido'
    if not value.get('aiPatient'):
        email = f"qa411-{value['run']}-ai@qa.coppaddresd.test"
        target = f"CoppAddresd/QA/4.11/{value['run']}/aiPatient"
        h.write_credential(target,email,'Qa!9'+secrets.token_urlsafe(28))
        value['aiPatient'] = {'patientId':str(uuid.uuid4()),'purpose':'Solo sugerencias/caida IA; NO acredita asignacion post-tests'}
        value['accounts']['aiPatient'] = {'login':email,'application':'app','credentialTarget':target,'documentNumber':'411'+str(secrets.randbelow(10**10)).zfill(10)}
        save(path,value)
    account=value['accounts']['aiPatient'];patient=value['aiPatient']['patientId']
    if not account.get('userId'):
        credential=h.read_credential(account['credentialTarget'])
        created=h.request('POST',h.AUTH+'/api/auth/users',{'email':credential['login'],'password':credential['password'],'firstName':'QA411','lastName':'IA independiente'})
        account['userId']=created['id'];save(path,value)
    if not value['aiPatient'].get('profilePrepared'):
        with h.connect() as db:
            with db.cursor() as c:
                assert protected_digest(c)==value['protectedBefore']
                c.execute('INSERT INTO auth."UserApplications"("UserId","ApplicationId","CreatedAt","IsSuspended","SessionVersion") SELECT %s,"Id",now(),false,0 FROM auth."Applications" WHERE "Code"=\'app\' ON CONFLICT DO NOTHING',(account['userId'],))
                c.execute("INSERT INTO app.patient_profiles(id,user_id,first_name,last_name,status,timezone,document_number,email,date_of_birth,gender,league_opt_in) VALUES(%s,%s,'QA411','IA independiente','Activo','America/Bogota',%s,%s,DATE '1986-01-01','Femenino',false)",(patient,account['userId'],account['documentNumber'],account['login']))
        value['aiPatient']['profilePrepared']=True;save(path,value)
    token=h.login(account)['accessToken']
    if not value['aiPatient'].get('enrollmentId'):
        with h.connect() as db:
            with db.cursor() as c:
                c.execute('SELECT id FROM app.program_enrollments WHERE patient_id=%s',(patient,));rows=c.fetchall()
        assert len(rows)<=1,'No duplicar inscripciones QA'
        if rows:enrollment={'id':str(rows[0][0])}
        else:
            today=dt.datetime.now(dt.timezone.utc).astimezone(__import__('zoneinfo').ZoneInfo('America/Bogota')).date()
            enrollment=h.request('POST',h.API+'/api/v1/program/enrollments/me',{'patientId':None,'templateId':None,'timezone':'America/Bogota','startLocalDate':str(today)},token=token)
        value['aiPatient']['enrollmentId']=enrollment['id'];value['aiPatient']['weekNumber']=2;save(path,value)
    source=json.loads((OPS/'4.8-fixture.json').read_text(encoding='utf-8'))
    generator=source['accounts']['generator']
    config=(WORKSPACE/'coppAddresdBack/src/Services/CoppAddresd.Auth/appsettings.json').read_text(encoding='utf-8-sig')
    def field(key):
        found=re.search('"'+key+'"'+r'\s*:\s*"([^"\r\n]+)"',config)
        assert found,'Falta configuracion Auth local';return found.group(1)
    admin=h.request('POST',h.AUTH+'/api/auth/login',{'email':field('AdminEmail'),'password':field('AdminPassword'),'application':'erp','rememberMe':False})['accessToken']
    for patient_id in [value['patientId'],patient]:
        assignments=h.request('GET',h.API+'/api/v1/patients/'+patient_id+'/professionals',token=admin)
        if not any(a['professionalId']==generator['professionalId'] and a['status']=='Active' for a in assignments):
            h.request('POST',h.API+'/api/v1/patients/'+patient_id+'/professionals',{'professionalId':generator['professionalId'],'relationshipType':'Assigned'},token=admin)
    value['accounts']['generator']=generator
    erp_token=h.login(generator)['accessToken']
    base='/api/v1/program/erp/enrollments/'+value['aiPatient']['enrollmentId']+'/weeks/2'
    detail_path='/api/v1/program/enrollments/'+value['aiPatient']['enrollmentId']+'/week/2'
    detail=h.request('GET',h.API+detail_path,token=erp_token)
    suggestions=h.request('GET',h.API+base+'/ai-suggestions?language=es',token=erp_token)
    assert suggestions['draft'] is None and suggestions['status'] in ['empty','unavailable','insufficient']
    with h.connect() as db:
        with db.cursor() as c:
            c.execute('SELECT to_jsonb(w) FROM app.program_weeks w WHERE enrollment_id=%s AND week_number=2',(value['aiPatient']['enrollmentId'],))
            week=c.fetchone()[0]
            assert week['status']=='Locked' and week['activated_at'] is None and week['completed_at'] is None
            assert protected_digest(c)==value['protectedBefore']
    value['aiPatient'].update(status='ready-no-draft',weekDetailPath=detail_path,suggestionsPath=base+'/ai-suggestions',weekBefore=week,weekDetailBefore=detail,suggestionsBefore=suggestions,aiGenerated=False,suggestionApplied=False)
    save(path,value)
    print(json.dumps({'status':'ready-no-draft','patientId':patient,'enrollmentId':value['aiPatient']['enrollmentId'],'weekNumber':2,'suggestionsStatus':suggestions['status'],'protectedUnchanged':True,'testsPatientStill8of9':state(value['patientId'])['enrollments']==0}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['prepare', 'prepare-ai', 'check'])
    parser.add_argument('--metadata', type=Path, default=OPS / '4.11-app-fixture.json')
    args = parser.parse_args()
    if args.mode == 'prepare': prepare(args.metadata.resolve())
    elif args.mode == 'prepare-ai': prepare_ai(args.metadata.resolve())
    else: check(args.metadata.resolve())
