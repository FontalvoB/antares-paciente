"""Lectura de los dos pacientes cerrados; no modifica datos ni la fixture 4.11."""
import importlib.util
import json
from pathlib import Path

helper = Path(__file__).resolve().parents[5] / '.ai/operations/organizar-experiencia-bienestar/3.20-fixture-helper.py'
spec = importlib.util.spec_from_file_location('qa_credentials', helper)
h = importlib.util.module_from_spec(spec)
spec.loader.exec_module(h)
ids = ['0c487f75-a462-4fda-894d-61c031441884', 'ef59c692-d01a-4105-b3ea-05c07ff76279']
queries = {
    'intakes': 'SELECT t.* FROM app.nutrition_intake_logs t WHERE patient_id=ANY(%s::uuid[])',
    'publishedReviews': 'SELECT t.* FROM app.nutrition_cycle_reviews t JOIN app.nutrition_cycles c ON c.id=t.cycle_id WHERE c.patient_id=ANY(%s::uuid[]) AND t.published_at IS NOT NULL',
    'publishedPlans': 'SELECT t.* FROM app.nutrition_prescriptions t WHERE patient_id=ANY(%s::uuid[]) AND is_published=true',
}
result = {}
with h.connect() as db:
    with db.cursor() as cursor:
        cursor.execute('SET TRANSACTION READ ONLY')
        for key, query in queries.items():
            cursor.execute("SELECT count(*),md5(coalesce(string_agg(to_jsonb(p)::text,'' ORDER BY id),'')) FROM (" + query + ') p', (ids,))
            count, digest = cursor.fetchone()
            result[key] = {'count': count, 'digest': digest}
print(json.dumps(result))
