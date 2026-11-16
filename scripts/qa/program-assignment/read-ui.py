"""Estado 4.11 UI: exclusivamente READ ONLY; conserva la fixture APP aparcada."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
OPS = ROOT / '.ai/operations/organizar-experiencia-bienestar'

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

try:
    helper = load_module('qa411back', OPS / '4.11-back-fixture-helper.py')
    back = helper.load()
    metadata = Path(os.environ.get('COP411_UI_METADATA', str(OPS / '4.11-ui-app-fixture.json')))
    fixture = json.loads(metadata.read_text(encoding='utf-8'))
    assert fixture['patientId'] not in helper.FORBIDDEN, 'Usar paciente UI propio, nunca la fixture aparcada'
    value = {**back, 'accounts': {**back['accounts'], 'patient': {**fixture['accounts']['patient'], 'patientId': fixture['patientId']}}}
    protected = helper.protected(back)
    assert protected == back['protectedBefore'], 'Sentinelas BACK/APP aparcada cambiaron'
    state = helper.read_state(value)
    with helper.h.connect() as db:
        db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
        weeks = [row[0] for row in db.execute('SELECT status FROM app.program_weeks WHERE enrollment_id IN (SELECT id FROM app.program_enrollments WHERE patient_id=%s) ORDER BY week_number', (fixture['patientId'],)).fetchall()]
        recommendations = db.execute('SELECT proposal FROM app.program_assignment_recommendations WHERE patient_id=%s ORDER BY id', (fixture['patientId'],)).fetchall()
        proposals = [json.loads(row[0]) if isinstance(row[0], str) else row[0] for row in recommendations]
        template_policy = [{'useTemplatePodcastDefault': proposal.get('useTemplatePodcastDefault'), 'matchedRules': proposal.get('matchedRules'), 'podcastCells': len(proposal.get('podcastSequence') or [])} for proposal in proposals]
        media_ids = [cell['mediaId'] for proposal in proposals for cell in proposal.get('podcastSequence') or [] if cell.get('mediaId')]
        media = [{'id': str(row[0]), 'published': row[1] == 'Published', 'blankKey': not bool((row[2] or '').strip()), 'demo': (row[2] or '').strip().lower() == 'media/podcasts/demo-copp.mp3'} for row in db.execute('SELECT id,status,storage_key FROM app.media_items WHERE id=ANY(%s::uuid[]) ORDER BY id', (media_ids,)).fetchall()]
        db.rollback()
    print(json.dumps({'patientId': fixture['patientId'], 'state': state, 'weekStatuses': weeks, 'templatePolicy': template_policy, 'podcastMedia': media, 'protected': protected,
                      'metadataSha256': hashlib.sha256(metadata.read_bytes()).hexdigest()}, default=str))
except Exception as error:
    print(json.dumps({'failed': True, 'type': type(error).__name__, 'reason': str(error) if isinstance(error, AssertionError) else 'Detalle omitido'}))
    raise SystemExit(1) from None
