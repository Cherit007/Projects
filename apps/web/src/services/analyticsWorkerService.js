import * as Comlink from 'comlink';

let workerInstance = null;
let workerApi = null;

const supportsWorker = () => typeof Worker !== 'undefined';

const getWorkerApi = () => {
  if (!supportsWorker()) return null;
  if (workerApi) return workerApi;

  workerInstance = new Worker(
    new URL('../workers/analytics.worker.js', import.meta.url),
    { type: 'module' }
  );
  workerApi = Comlink.wrap(workerInstance);
  return workerApi;
};

const invokeWorkerMethod = async (method, payload) => {
  const api = getWorkerApi();
  if (!api) {
    throw new Error('Analytics worker is not available in this runtime');
  }
  return api[method](payload);
};

export const analyticsWorkerService = {
  isSupported: supportsWorker,

  computePairingAnalytics(payload = {}) {
    return invokeWorkerMethod('computePairingAnalytics', payload);
  },

  computeFormPowerRankings(payload = {}) {
    return invokeWorkerMethod('computeFormPowerRankings', payload);
  },

  computeProfileInsights(payload = {}) {
    return invokeWorkerMethod('computeProfileInsights', payload);
  },

  computeDashboardDerived(payload = {}) {
    return invokeWorkerMethod('computeDashboardDerived', payload);
  },

  terminate() {
    if (workerInstance) {
      workerInstance.terminate();
      workerInstance = null;
      workerApi = null;
    }
  },
};

