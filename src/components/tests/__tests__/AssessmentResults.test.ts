import { describe, expect, it } from "vitest";
import { analyzeAssessmentProfile, groupAssessmentResults } from "../../../utils/assessmentResults";
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
  it('clears historical subscale classifications without modifying the source result', () => {
    const saved = { ...result('dimension', 'evaluation', 'subscale', 4), qualifier: 'bajo', severity: 'low' };
    const displayed = groupAssessmentResults([saved])[0].score;
    expect(displayed.value).toBe(4);
    expect(displayed.qualifier).toBeNull();
    expect(displayed.severity).toBeNull();
    expect(saved.qualifier).toBe('bajo');
    expect(saved.severity).toBe('low');
  });

});

describe('grounded profile analysis', () => {
  it('does not hide stored attention severity when the text classification is absent', () => {
    const indicator = { ...result('flag', 'one', 'indicator', 2), qualifier: null, severity: 'high' };
    expect(analyzeAssessmentProfile([indicator]).attention).toEqual([indicator]);
  });
  it('uses stored severity and includes derived indicators without inventing score cutoffs', () => {
    const total = { ...result('total', 'one', 'score', 140), qualifier: null };
    const indicator = { ...result('indicator', 'one', 'indicator', 2), qualifier: 'Revisar', severity: 'high' };
    const summary = analyzeAssessmentProfile([total, indicator]);
    expect(summary.evaluations).toBe(1);
    expect(summary.unclassified).toBe(1);
    expect(summary.attention).toEqual([indicator]);
  });
  it('ignores historical subscale risk labels and keeps separate attempts', () => {
    const dimension = { ...result('dimension', 'one', 'subscale', 99), severity: 'high' };
    const second = { ...result('total', 'two', 'score', 400), qualifier: null };
    const summary = analyzeAssessmentProfile([dimension, second]);
    expect(summary.evaluations).toBe(2);
    expect(summary.attention).toEqual([]);
    expect(summary.unclassified).toBe(2);
  });
});
