//计算地图坐标的两个点之间的距离，返回的是以米为单位的直线距离
//注意输入参数的形式 后续要改成coordinate类
function MetersBetweenMapCoordinates(p1,p2){
  var MeterP1 = lngLatToXY(p1);
  var MeterP2 = lngLatToXY(p2);
  return MeterBetweenTwoPoints(MeterP1,MeterP2)

}

//wgs84坐标转墨卡托投影坐标
function lngLatToXY(pt) {//经纬度转化为平面坐标
  var _a = 20037508.342789;

  var lng = pt["x"];//经度
  var lat = pt["y"];//纬度

  if (lat > 89.999999) {
    lat = 89.999999;
  }
  else if (lat < -89.999999) {
    lat = -89.999999;
  }
  var x = lng * _a / 180;
  var y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  y = y * _a / 180;

  return { x: x, y: y };
}

//we墨卡托（xy）转wgs1984坐标
function XYTolngLat(pt) {//经纬度转化为平面坐标
  var _a = 20037508.342789;
  var x = pt["x"];//经度
  var y = pt["y"];//纬度

  var lon = x / _a * 180;
  var lat = y / _a * 180;
  lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  return { x: lon, y: lat };
}

//计算两点之间的直线距离
function MeterBetweenTwoPoints(p1,p2){
  return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));
}



