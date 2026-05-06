const scoringService = require('../../services/ScoringService');

describe('ScoringService.calculateFromVital', () => {
  it('returns incomplete object when required fields are missing', () => {
    expect(scoringService.calculateFromVital(null)).toBeNull();
    const result = scoringService.calculateFromVital({ bpSystolic: 120 });
    expect(result).not.toBeNull();
    expect(result.isComplete).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('produces a low-risk score for normal vitals', () => {
    const result = scoringService.calculateFromVital({
      bpSystolic: 120,
      bpDiastolic: 70,
      temp: 37,
      pulse: 80,
      respRate: 16,
      spo2: 98
    });

    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.status === 'healthy' || result.status === 'stable').toBe(true);
  });

  it('assigns high points and critical risk for extreme derangements', () => {
    const result = scoringService.calculateFromVital({
      bpSystolic: 70,
      bpDiastolic: 40,
      temp: 40.5,
      pulse: 150,
      respRate: 35,
      spo2: 85
    });

    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.status).toBe('critical');
  });

  it('marks missing optional parameters correctly', () => {
    const result = scoringService.calculateFromVital({
      bpSystolic: 110,
      bpDiastolic: 70,
      temp: 36.5,
      pulse: 75
    });

    expect(result.isComplete).toBe(false);
    expect(result.warnings).toContain('Respiration rate missing');
    expect(result.warnings).toContain('SpO2 missing');
  });
});

