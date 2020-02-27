const utils = require('./utils')
const zoom = 19;
const range = "";
const distanceConvertor = function (rssi) {
  return Math.pow(10, (Math.abs(rssi) - 59) / 10 / 3);
};
var sensorMonitor = new utils.SensorMonitorManager(zoom, distanceConvertor, range);
sensorMonitor.scheduleCalculationTimer();
// 在 Worker 线程执行上下文会全局暴露一个 worker 对象，直接调用 worker.onMeesage/postMessage 即可
worker.onMessage(function (res) {
  console.log(res);
  sensorMonitor.updateBeaconsOnBeaconChange(res["beacons"]);
})