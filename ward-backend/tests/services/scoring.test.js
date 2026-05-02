const scoringService = require('../../services/ScoringService');

describe('ScoringService - NEWS2 Calculation', () => {
  test('Healthy patient should score 0', () => {
    const vitals = {
      respirationRate: 15,
      spo2: 98,
      onOxygen: false,
      systolicBP: 120,
      heartRate: 70,
      consciousness: 'alert',
      temperature: 36.6
    };
    const result = scoringService.calculateNEWS2(vitals);
    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe('LOW');
    expect(result.status).toBe('healthy');
  });

  test('Critical patient (Multiple deviations) should score high', () => {
    const vitals = {
      respirationRate: 26, // +3
      spo2: 90,           // +3
      onOxygen: true,     // +2
      systolicBP: 85,      // +3
      heartRate: 135,     // +3
      consciousness: 'voice', // +3
      temperature: 39.5   // +2
    };
    const result = scoringService.calculateNEWS2(vitals);
    expect(result.score).toBe(19);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.status).toBe('critical');
  });

  test('Partial vitals should return score with warnings', () => {
    const vitals = {
      respirationRate: 22, // +2
      heartRate: 115,     // +2
    };
    const result = scoringService.calculateNEWS2(vitals);
    expect(result.score).toBe(4);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.isComplete).toBe(false);
  });

  test('Hypothermia should score correctly', () => {
    const vitals = {
      respirationRate: 12,
      spo2: 96,
      onOxygen: false,
      systolicBP: 115,
      heartRate: 60,
      consciousness: 'alert',
      temperature: 34.5 // +3
    };
    const result = scoringService.calculateNEWS2(vitals);
    expect(result.score).toBe(3);
    expect(result.riskLevel).toBe('LOW');
  });
});
