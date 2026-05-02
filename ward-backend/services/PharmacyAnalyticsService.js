const pharmacyRepository = require('../repositories/PharmacyRepository');

class PharmacyAnalyticsService {
  /**
   * Calculates consumption stats for all medications in a tenant.
   * @param {string} tenantId 
   * @param {number} daysLookback Default is 7 days
   */
  async getConsumptionStats(tenantId, daysLookback = 7) {
    const inventory = await pharmacyRepository.listStock(tenantId);
    const history = await pharmacyRepository.getDispenseHistory(tenantId, daysLookback);

    // Map history for quick lookup
    const historyMap = history.reduce((acc, curr) => {
      acc[curr.medicationId] = curr.totalDispensed;
      return acc;
    }, {});

    const stats = inventory.map(item => {
      const totalDispensed = historyMap[item.id] || 0;
      const dailyBurnRate = totalDispensed / daysLookback;
      
      let runwayDays = null;
      if (dailyBurnRate > 0) {
        runwayDays = Math.floor(item.totalQuantity / dailyBurnRate);
      } else if (item.totalQuantity > 0) {
        runwayDays = 999; // Essentially infinite with 0 burn rate
      } else {
        runwayDays = 0;
      }

      let status = 'healthy';
      if (runwayDays <= 3) status = 'critical';
      else if (runwayDays <= 7) status = 'warning';

      return {
        medicationId: item.id,
        name: item.name,
        totalQuantity: item.totalQuantity,
        itemUnit: item.itemUnit,
        totalDispensed,
        dailyBurnRate: parseFloat(dailyBurnRate.toFixed(2)),
        runwayDays,
        status
      };
    });

    return stats;
  }

  /**
   * Get high-risk items (runway <= 7 days)
   */
  async getRiskAnalysis(tenantId) {
    const stats = await this.getConsumptionStats(tenantId);
    return stats.filter(s => s.status !== 'healthy' || s.totalQuantity === 0);
  }
}

module.exports = new PharmacyAnalyticsService();
