import { describe, expect, it } from "vitest";
import { groupAssessmentResults } from "../../../utils/assessmentResults";
import type { MeResult } from "../../../utils/healthTestsApi";
const result = (id: string, evaluationId: string, resultType: MeResult['resultType'], value: number): MeResult => ({ id, evaluationId, resultType, code: 'temperamento', label: id, value, qualifier: 'alto', severity: null });
describe('assessment result grouping', () => {
  it('keeps separate attempts and attaches subscales to the correct score', () => {
    const groups = groupAssessmentResults([result('detail-new', 'new', 'subscale', 4), result('score-new', 'new', 'score', 140), result('score-old', 'old', 'score', 7), result('detail-old', 'old', 'subscale', 2)]);
    expect(groups).toHaveLength(2);
    expect(groups[0].score.value).toBe(140);
    expect(groups[0].details.map(r => r.id)).toEqual(['detail-new']);
    expect(groups[1].details.map(r => r.id)).toEqual(['detail-old']);
  });
  it('preserves unclassified indicator data without inventing a total score', () => {
    const item = result('indicator', 'evaluation', 'indicator', 5.9);
    expect(groupAssessmentResults([item])).toEqual([{ id: 'evaluation', score: item, details: [] }]);
  });
});
