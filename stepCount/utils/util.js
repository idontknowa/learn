const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : '0' + n
}

//计算地图坐标的两个点之间的距离，返回的是以米为单位的直线距离
//注意输入参数的形式 后续要改成coordinate类
function MetersBetweenMapCoordinates(p1, p2) {
  var MeterP1 = lngLatToXY(p1);
  var MeterP2 = lngLatToXY(p2);
  return MeterBetweenTwoPoints(MeterP1, MeterP2)

}


//计算两点之间的直线距离
function MeterBetweenTwoPoints(p1, p2) {
  return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));
}



//wgs84坐标转墨卡托投影坐标
function lngLatToXY(coordinate) {//经纬度转化为平面坐标
  var _a = 20037508.342789;

  var lng = coordinate.longitude;//经度
  var lat = coordinate.latitude;//纬度

  if (lat > 89.999999) {
    lat = 89.999999;
  }
  else if (lat < -89.999999) {
    lat = -89.999999;
  }
  var x = lng * _a / 180;
  var y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
  y = y * _a / 180;

  return new Point(x,y,coordinate.levelcode);
}

//we墨卡托（xy）转wgs1984坐标
function XYTolngLat(point) {//经纬度转化为平面坐标
  var _a = 20037508.342789;
  var x = point.x;//经度
  var y = point.y;//纬度

  var lon = x / _a * 180;
  var lat = y / _a * 180;
  lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
  return new Coordinate(lon,lat,point.levelcode);
}

function DEGREE_TO_RADIUS(degree){
  return Math.PI * (degree/360.0);
}



class Point {
  constructor(x, y, levelcode) {
    this.x = x;
    this.y = y;
    this.levelcode = levelcode;

  }
  x() { return this.x }
  y() { return this.y }
  toLngLat() {
    return XYTolngLat(this);
  }
}

class Coordinate {
  constructor(x, y, levelcode) {
    this.longitude = x;
    this.latitude = y;
    this.levelcode = levelcode;

  }
  longitude() { return this.longitude }
  latitude() { return this.latitude }
  toXY() {
    return lngLatToXY(this);
  }
}

class Vector2D {
  constructor(x, y) {
    this.x = x;
    this.y = y;

  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  direction(){
    var length = this.length();
    var dir_x = this.x / length;
    var dir_y = this.y /length;
    if (dir_x == 0){
      if (dir_y == 0){
        return 0;
      }
      else if (dir_y > 0) {
        return Math.PI/2;
      }
      else{
        return Math.PI/2*3;
      }
    }
    else if (dir_y == 0){
      if (dir_x > 0){
        return 0;
      }
      else{
        return Math.PI;
      }

    }
    else{
      var tan = dir_y/dir_x;
      return Math.atan(tan);
    }
  }
}

class Vector3D {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }
}

class Attitude{
  constructor(alpha, beta, gamma) {
    this.roll = alpha;
    this.pitch = beta;
    this.yaw = gamma;
  }
}
class Acceleration{
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

class Route {
  constructor(start, end, levelcode, sequence) {
    this.start = start;
    this.end = end;
    this.levelcode = levelcode;
    this.sequence = sequence;
  }

  length() {
    return MetersBetweenMapCoordinates(this.start, this.end);
  }
}

class Heading{
  constructor(heading) {
    this.heading = heading;
    this.true_heading = this.TrueHeading(this.heading);
  }

  TrueHeading(heading){
    return 2 * Math.PI * ((450 - heading) / 360.0);
  }
}
class RouteManager {
  constructor(routes) {
    this.HEADING_FACTOR = 10.0;
    this.DISTANCE_FACTOR = 40.0;
    this.navigationRoutes = routes;
  }
  //更新导航路径
  updateRoutesForNavigation(routes) {
    this.navigationRoutes = routes;
  }
  //删除导航路径
  removeRoutesForNavigation() {
    this.navigationRoutes = null;
  }

  //public
  getNearestRouteWithoutHeading(point) {
    return this.getNearestRouteForPoint(point, this.navigationRoutes);
  }

  //public
  getNearestRouteWithHeading(point, heading) {
    return this.getNearestRouteForNavigationFromPointWithHeading(point, heading, this.navigationRoutes);
  }


  //逻辑函数 寻找距离某点最近的路径 
  getNearestRouteForPoint(point, routes) {
    var lastDistance = 999;
    var nearestRoute;
    for (var i = 0; i < routes.length; i++) {
      
      var distance = this.distanceFromCoordinate(point, routes[i]);
      if (lastDistance > distance) {
        lastDistance = distance;
        nearestRoute = routes[i];
      }
    }
    return nearestRoute;
  }


  //在有手机朝向参数情况下使用 该情况下不能单纯使用距离点最近的路径 要考虑手机的朝向
  getNearestRouteForNavigationFromPointWithHeading(point, heading, routes) {
    var lastWeight = -999;

    var nearestRoute;

    for (var i in routes) {
      var route = routes[i];
      //楼层不同的不计算
      // if (route.levelcode != point.levelcode) {
      //   continue;
      // }

      var distanceWeight = this.distanceWeightFromPoint(point, route);
      var headingWeight = this.headingWeightToRoute(route, heading);
      var total = distanceWeight + headingWeight;
      if (lastWeight < total) {
        lastWeight = total;
        nearestRoute = route;
      }

    }
    return nearestRoute;
  }

  //
  distanceWeightFromPoint(point, route) {
    var distance = this.distanceFromCoordinate(point, route);
    var factor;
    if (distance > 160) {
      factor = 0.0;
    }
    else {
      factor = (80 - distance) / 80.0;
    }

    return factor * this.DISTANCE_FACTOR;
  }

  //根据朝向和路径计算权重
  headingWeightToRoute(route, heading) {
    if (!heading) return 0;
    return this.vectorBasedWeightToRoute(route, heading);
  }

  vectorBasedWeightToRoute(route, heading) {
    //heading类
    var trueHeading = heading.true_heading;
    //路的朝向
    var routeHeading = this.headingFrom(route.start,route.end);
    //用cos/sin 表示朝向单位向量
    var trueVector = new Vector2D(Math.sin(DEGREE_TO_RADIUS(trueHeading)), Math.cos(DEGREE_TO_RADIUS(trueHeading)));
    //道路的单位向量
    var routeVector = new Vector2D(Math.sin(DEGREE_TO_RADIUS(routeHeading)), Math.cos(DEGREE_TO_RADIUS(routeHeading)));
    //  一个新矢量，其分量分别表示在两个源矢量的相同位置上找到的分量之间的差异。
    var vector = new Vector2D(trueVector.x - routeVector.x, trueVector.y - routeVector.y);
    //GLKVector2Subtract(trueVector, routeVector);
    //返回vector向量的长度
    var length = vector.length();
    //长度的平方
    var len2 = Math.pow(length, 2);                  // 0 - 4, 2 is in the middle
    var adjusted = len2 > 2 ? 4 - len2 : len2;  // 0 - 2
    var factor = (2 - adjusted) / 2.0;          // 0 - 1, 0 means vertical

    return factor * this.HEADING_FACTOR;
  }

  headingFrom(start,end){
    var vector = new Vector2D(end.longitude-start.longitude,end.latitude-start.latitude);
    return vector.direction();
  }

  distanceFromCoordinate(coordinate, route) {
    var intersectionCoordinate = this.intersectingCoordinateFrom(coordinate, route);
    return MetersBetweenMapCoordinates(coordinate, intersectionCoordinate);
  }


  //计算点到线的距离  经纬度坐标
  distanceFromRoute(point, route) {
    var intersection = this.intersectingCoordinateFrom(point, route);
    return MetersBetweenMapCoordinates(point, intersection);
  }

  //计算点和线的交点 若点在线段上的投影超出线段，则返回距离线段起点和终点中距离该点最近的点
  intersectingCoordinateFrom(coordinate, route) {
    if (!route) return null;
    var start = route.start;
    var end = route.end;

    var a = (start.latitude - end.latitude);
    var b = (end.longitude - start.longitude);
    var c = (start.latitude * (start.longitude - end.longitude) - (start.longitude * (start.latitude - end.latitude)));

    var vector = new Vector3D(a, b, c);

    var longitude = (Math.pow(vector.y, 2) * coordinate.longitude - vector.x * vector.y * coordinate.latitude - vector.x * vector.z) / (Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
    var latitude = (-vector.x * vector.y * coordinate.longitude + Math.pow(vector.x, 2) * coordinate.latitude - vector.y * vector.z) / (Math.pow(vector.x, 2) + Math.pow(vector.y, 2));

    var intersectCoordinate = new Coordinate( longitude,latitude,start.levelcode);

    var vector1 = new Vector2D(start.longitude - longitude, start.latitude - latitude);
    var vector2 = new Vector2D(longitude - end.longitude, latitude - end.latitude);

    var m = vector1.x * vector2.x + vector1.y * vector2.y;

    if (m < 0) {
      //if point landing on extension cord, then find the nearest instead
      var startDistance = MetersBetweenMapCoordinates(intersectCoordinate, start);
      var endDistance = MetersBetweenMapCoordinates(intersectCoordinate, end);
      return startDistance < endDistance ? start : end;
    }
    else {
      return intersectCoordinate;
    }
  }
}
/*
   ACSensorMonitorManager

 */
class SensorMonitorManager{
  constructor(zoom, distance, range) {
    //rssi转为距离的函数或者对象
    this.distanceConvertor = distance;
    this.rangeConverter = range;
    this.rangedBeaconRegionConstrains = new Array();
    //字典
    this.beacons = new Map();
    this.beaconSet =new Set();
    this.beaconStacks = new Map();
    this.locationDesireAccuracy = 0;
    this.beaconFilter =  new BeaconFilter();
    this.nearestBeaconData=null;
    this.nearestBeaconDistance = 999;
    this.AC_AVAILABLE_DISTANCE=8;
    this.calculationTimer=null;
  }

  setNearestBeaconData(nearestBeaconData){
    //如果没有最近的数据
    if (!this.nearestBeaconData && !nearestBeaconData) return;
    //当前最近的beacon和上一个最近的相同
    //ACBeaconData ： _nearestBeaconData
    if (this.nearestBeaconData.isEqual(nearestBeaconData)) return;

    //重新设置最新的beacon  且更新
    this.nearestBeaconData = nearestBeaconData;
  }

  //重置最近的ibeacon
  resetNearestBeacon(){
    this.nearestBeaconData = null;
  }

  updateBeaconsOnBeaconChange(beacons){
    for (var i in beacons) {
      var constrains = new BeaconRegionConstrains(beacons[i].uuid);
      this.updateBeacons(beacons, constrains);
    }

  }

  //更新ibeacon数据 beacons:Beacon  constrains:ACBeaconRegionConstrains
  updateBeacons(beacons,constrains){
    var  startTime = new Date();
    //更新ibeacon
    var UUID = constrains.UUID;
    //如果没有任何ibeacon属性
    if (!beacons.length) {
      //删除指定指定uuid的要素  以及uuid
      //https://blog.csdn.net/FZUMRWANG/article/details/85238872
      this.beacons.removeObjectForKey(UUID);
      this.beaconSet.delete(UUID);

      //过滤器  还未实现
      var stacks =this.beaconStacksFilter(UUID);
      //
      for (var index in stacks) {
        this.beaconStacks.removeObjectForKey(key);
      }
      return;
    }

      this.beacons.set(UUID,beacons);
      this.beaconSet.add(UUID);
      for (var index in beacons) {
      //
      var beacon = beacons[index];
      var key = `${beacon.uuid}-${beacon.major}-${beacon.minor}`;
      //若ibeacon对应的stack存在
      var stack =this.beaconStacks.get(key);
      // 将stack 存储到 _beaconStacks中
      if (!stack) {
        stack = new BeaconStack(null);
        this.beaconStacks.set(key,stack);
      }

      stack.addBeacon(beacon);
    }
    var endTime = new Date();
    // console.log("UpdateBeacons:  " + (endTime - startTime));


}

  beaconStacksFilter(uuid) {
    var stacks = new Array();
    for (var [key, value] of this.beaconStacks){
      if (key.search(uuid) != -1 ){
        stacks.push(value)
      }
    }
    return stacks;

  }
  //计算最近的ibeacon
  calculateNearestBeacon(){
    var startTIme = new Date();
    if (!this.distanceConvertor) return;
    //ACBeaconData * data = nil;
    var data = null;
    //CLLocationDistance distance = CLLocationDistanceMax;
    var distance = 999;
    for (var [key, value] of this.beaconStacks) {
      var stack = value;
      if (!stack || !stack.fullStack()) continue;

      //ACBeaconRSSIOutput * output =[self.beaconFilter outputWithStack: stack];
      var output = this.beaconFilter.meanOutputWithStack(stack);
      //用于启动和停止将与位置相关的事件传递到应用程序的对象。
      //CLLocationDistance result = self.distanceConvertor(output);
      var result = this.distanceConvertor(output.rssi);
      if (result < distance) {
        distance = result;
        data = stack.data;
      }
    }
    //最小距离大于阈值或者没有找到最近的距离 返回空
    if (!data || distance > this.AC_AVAILABLE_DISTANCE) return;
    this.nearestBeaconData = data;
    this.nearestBeaconDistance = distance;
    // console.log("nearestBeacon SenMon   "+ data.UUID+"   " + distance);
    var endTime = new Date();
    // console.log("calculate Nearest Function Time:  " + (endTime -startTIme));
  
  }

  updateBeaconsWithoutInput(){
    var beacons = new Array();
    for(var [key,value] of this.beacons){
      beacons.push(value);
    }
    //sort
    //：https://blog.csdn.net/qq_37724450/article/details/79241522
    var filtered = beacons.sort(function(a,b){
      if (a.accuracy === b.accuracy) {
        return -(b.proximity - a.proximity);
      } else {
        return -(b.accuracy - a.accuracy);
      }
    });

    }

  scheduleCalculationTimer(){
    this.invalidateCalculationTimer();
    var _this = this;

    this.calculationTimer = setTimeout(function(){
      _this.updateBeaconsWithoutInput();
      _this.calculateNearestBeacon();
      _this.invalidateCalculationTimer();
      _this.scheduleCalculationTimer();
    },1000);

  }

  invalidateCalculationTimer(){
    if (!this.calculationTimer) return;

    clearTimeout(this.calculationTimer);
    this.calculationTimer = null;
}

}

/*Beacon class  存储beacon的属性信息 */
class Beacon{
  constructor(){
    this.UUID = "";
    this.plateID = "";
    this.tileCode = "";
    this.levelCode = "";
    this.name = "";
    this.searchable = "";
    this.speakout = "";
    this.roomID = "";
    this.roomName = "";
    this.buildingID = "";
    this.buildingName = "";
    this.type = "";
    this.mPower = "";
    this.latitude = "";
    this.longitude = "";
    this.indoor = "";
  }

  setObjectWithDict(dict) {
    this.UUID = this.formattedUUIDFromString(dict["uuid"]);
    this.plateID = dict["plate_code"];
    this.tileCode = dict["tile_code"];
    this.levelCode = dict["level_code"];
    this.name = dict["name"];
    this.searchable = dict["searchable"];
    this.speakout = dict["speakout"];
    this.roomID = dict["roomID"];
    this.roomName = dict["roomName"];
    this.buildingID = dict["buildingID"];
    this.buildingName = dict["buildingName"];
    this.type = dict["type"];
    this.mPower = dict["mPower"];
    this.latitude = dict["latitude"];
    this.longitude = dict["longitude"];
    this.indoor = dict["indoor"];
  }

  formattedUUIDFromString(string){
    var connector ="-";
    var s1 = string.slice(0, 8);
    var s2 = string.slice(8, 12);
    var s3 = string.slice(12, 16);
    var s4 = string.slice(16, 20);
    var s5 = string.slice(20, 32);

    return `${s1}${connector}${s2}${connector}${s3}${connector}${s4}${connector}${s5}`;
  }

  modelCustomTransformFromDictionary(dic) {
  var string = dic["uuid"];
  this.UUID = this.formattedUUIDFromString(string);
  this.plateID = string.toUpperCase();
  return true;
  }
}
/*POI*/
class Poi {
  constructor() {
    this.title = null;
    this.level_code = null;
    this.name = null;
    this.poi_type = null;
    this.latitude = null;
    this.longitude = null;
    this.map_scale = null;
    this.staff = null;
    this.tile_code = null;
    this.parking_field = null;
    this.address = null;
    this.tel = null;
    this.images = null;
    this.openning = null;
    this.introduction = null;
    this.website = null;
    this.markerID = null;
  }

  setObjectWithDict(dict) {
    this.title = dict["title"];
    this.level_code = dict["level_code"];
    this.name = dict["name"];
    this.poi_type = dict["poi_type"];
    this.latitude = dict["latitude"];
    this.longitude = dict["longitude"];
    this.map_scale = dict["map_scale"];
    this.staff = dict["staff"];
    this.tile_code = dict["tile_code"];
    this.parking_field = dict["parking_field"];
    this.address = dict["address"];
    this.tel = dict["tel"];
    this.images = dict["images"];
    this.openning = dict["openning"];
    this.introduction = dict["introduction"];
    this.website = dict["website"];
  }

}

/*BeaconData class*/
class BeaconData{
  constructor(uuid, major,minor) {
    this.UUID = uuid;
    this.major = major;
    this.minor = minor;
  }

  isEqual(object){
    if (!object) return false;
    if (!(object.constructor.name ==this.constructor.name)  || !object)
      return false;
  return this.isEqualToData(object);
}
//判断输入要素是否和本要素相同的逻辑函数
  isEqualToData (data){
    return (this.UUID == data.UUID) && (this.major == data.major) &&   (this.minor == data.minor);
  }

  description(){
    return `${this.UUID}-${this.major}-${this.minor}`;
}
}
/*BeaconFilter  计算rssi*/
class BeaconFilter{
  constructor() {
    this.processNoise = 0.008;
  }
  outputWithStack(stack){
    //均值
    var mean = stack.rssiMeanValue();
    //方差 作为噪音
    var measurementNoise = this.measurementNoiseForStack(stack);
    var rssiErrorCovariance;
    var lastErrorCovariance = 1;
    var estimated = mean;
    //rssi值的修正  大概是在滤波
    var rssiValues = stack.rssiValues();
    for (var index in rssiValues ) {
      var value = rssiValues[index];
      var kalmanGain = lastErrorCovariance / (lastErrorCovariance + measurementNoise);
      estimated = estimated + (kalmanGain * (parseInt(value) - estimated));
      rssiErrorCovariance = (1 - kalmanGain) * lastErrorCovariance;
      lastErrorCovariance = rssiErrorCovariance + this.processNoise;
    }

    //输出ibeacon 的uuid major minor 以及修正的rssi
    var output = new BeaconRSSIOutput( stack.data.UUID, stack.data.major,stack.data.minor, estimated);
    return output;
}

  measurementNoiseForStack(stack){
  //均值
    var mean = stack.rssiMeanValue();
    var sum = 0.0;
    //获取rssi值
    var values = stack.rssiValues();
    for (var index in values) {
      sum += Math.pow(values[index] - mean, 2);
    }

    return sum / values.length;
}
  meanOutputWithStack(stack){
    var output = new BeaconRSSIOutput(stack.data.UUID, stack.data.major, stack.data.minor, stack.rssiMeanValue());
  return output;
  }
}
/*BeaconRSSIOutput  */
class BeaconRSSIOutput{
  constructor(uuid, major, minor,rssi) {
    this.UUID = uuid;
    this.major = major;
    this.minor = minor;
    this.rssi= rssi;
  }
}

/*BeaconStack  */
class BeaconStack {
  constructor(stackSize) {
    if (!stackSize) {
      this.stack = new Array(5);
      this.stackSize = 5;}
    
    else{
      this.stack = new Array(stackSize);
      this.stackSize = stackSize;
    }
    this.data = "";
    this.count = 0;
  }

  addBeacon(beacon){
  //如果是第一次加入的beacon
    if (!this.data) {
    //实例化ACBeaconData类
    this.data = new BeaconData (beacon.uuid,beacon.major,beacon.minor);
    }
    //数据入栈
    this.stack.unshift(beacon.rssi);
    this.count++;

    //若栈满 则移除最后一个要素
    if (this.count >= this.stackSize + 1) {
      this.stack.splice(this.stackSize , this.stack.length - this.stackSize );
      this.count = this.stackSize;
    }
   
 
  }

  fullStack(){
    var isfullStack = (this.count == this.stackSize);
    return isfullStack;
  }

  rssiMeanValue(){
    var mean = 0;
    for (var index  in this.stack) {
      mean += this.stack[index];
    }

    var rssi = mean / this.count;
    return rssi;
}

  rssiValues(){
    var [...res] = this.stack;
    return res ;
  }

}

/*AccelerationStack  */
class AccelerationStack {
  constructor(stackSize) {
    if (!stackSize) {
      this.stack = new Array(5);
      this.stackSize = 5;
    }

    else {
      this.stack = new Array(stackSize);
      this.stackSize = stackSize;
    }
    this.count = 0;
  }

  addAcceleration(acceleration) {
    //如果是第一次加入的beacon
    //数据入栈
    var z = Math.sqrt(acceleration.x * acceleration.x + acceleration.y * acceleration.y + acceleration.z * acceleration.z);
    this.stack.unshift(z);
    this.count++;

    //若栈满 则移除最后一个要素
    if (this.count >= this.stackSize + 1) {
      this.stack.splice(this.stackSize, this.stack.length - this.stackSize);
      this.count = this.stackSize;
    }
  }

  fullStack() {
    var isfullStack = (this.count == this.stackSize);
    return isfullStack;
  }

  accelerationMeanValue() {
    var sum = 0;
    for (var index in this.stack) {
      sum += this.stack[index];
    }

    var acceleration = sum / this.count;
    return acceleration;
  }

  accelerationValues() {
    var [...res] = this.stack;
    return res;
  }
}



class AccelerationManager {
  constructor() {
    //rssi转为距离的函数或者对象
    this.stack = new AccelerationStack();
    this.meanA = null;
  }


  //重置最近的ibeacon
  resetStack() {
    this.stack = new AccelerationStack();
  }

  updateAcceleration(acceleration) {
    if (!this.stack) this.stack = new AccelerationStack();
    this.stack.addAcceleration(acceleration);
    this.meanA = this.stack.accelerationMeanValue();
    return this.meanA;
  }

}


/*BeaconLocation*/
//(ACBeaconData *) data coordiante: (CLLocationCoordinate2D)coordinate distance: (CLLocationDistance)distance
class BeaconLocation{
  constructor(data,coordinate,distance) {
    this.data=data;
    this.coordinate = coordinate;
    this.distance = distance;
  }


}

class BeaconRegionConstrains{
  constructor(uuid) {
    this.UUID = uuid;
  }
}

//在导航过程中的一些全局 变量
class NavigationState{
  constructor() {
    this.lastLocation = null;
    this.nowLocation = null;
    this.lastNearestBeacon = null;
    this.nowNearestBeacon = null;
    this.updateAccuracy=0;
    this.startDeadReckoning = false;
    this.withinCofidence = false;
    this.accuracyTimerLoop = 30;
    this.startNavigate = false;
  }

  resetAccuracyTimer(){
    this.accuracyTimerLoop = 30;
  }
  
  setUpdateAccuracy(accuracy){
    this.updateAccuracy = accuracy;

  }

  updateNearestBeacon(beacondata){
    this.lastNearestBeacon = this.nowNearestBeacon;
    this.nowNearestBeacon = beacondata;
  }

  _startDR(){
    this.startDeadReckoning = true;
  }

  _stopDR(){
    this.startDeadReckoning = false;
  }

  setNearestBeacon(beacon){
    this.nearestBeacon = beacon;
  }

  clearNearestBeacon(){
    this.nearestBeacon = null;
  }

  clearLocation(){
    this.lastLocation = null;
    this.nowLocation = null;
  }


}



/* Dead Reckoning */
class DeadReckoning{
  constructor(app) {
    this.app = app;
  }

  stopDeadReckoning(){
    wx.stopAccelerometer();
  }

  startDeadReckoning(){
    return null;
  }
}

class APIManager{
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  getPOIsWithType(type,text){
    var postData ={};
    
    if (!(type.length || text.length)){
      console.log("search type and text should not be nil at same time");}
    if (text) {
      postData["name"] = text;
    }
    else {
      postData["type"] = type;
    }
    console.log(postData);

    // var request = 
    var _this = this;
    var getPOI = new Promise(function (resolve, reject) {
       wx.request({
          method: 'POST',
          url: _this.baseURL+"poi_search",
          data: _this.json2Form(postData),
          header: {
            'Content-Type': 'application/x-www-form-urlencoded', // 默认值
          },
          success: function (res) {
            //服务器返回数据
            if (res.statusCode == 200) {
              resolve(res);
            } else {
              //返回错误提示信息
              reject(res.data);
            }
          },
          fail: function (e) {
            reject(e);
            wx.showToast({
              title: '无法连接服务器',
              icon: 'loading',
              duration: 1000
            })
            // reject('网络出错');
          }
          });
    });
   
    return getPOI;
  }

 json2Form(json) {
  var str = [];
  for (var p in json) {
    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(json[p]));
  }
  console.log(str.join("&"));
  return str.join("&");

}
  getRoutesFromCoordinate(_from,_to){
    var parma = {
    from_lat: _from.latitude,
    from_lon : _from.longitude,
    from_level: _from.levelcode,
    to_lat: _to.latitude,
    to_lon : _to.longitude,
    to_level: _to.levelcode
    }
    var _this = this;
    // var p1 = new Coordinate(122.290841, 29.968225, "099");
    // var p2 = new Coordinate(122.290841, 29.968295, "099");
    // var p3 = new Coordinate(122.290728, 29.968295, "099");
    // var p4 = new Coordinate(122.290728, 29.968225, "099");
    // var route1 = new Route(p1, p2, "099", 0);
    // var route2 = new Route(p2, p3, "099", 0);
    // var route3 = new Route(p3, p4, "099", 0);
    // var routes = new Array(route1, route2, route3);
    //var RM = new util.RouteManager(routes);
    // return routes;
    return new Promise(function (resolve, reject) {
      wx.request({
        method: 'POST',
        url: _this.baseURL + 'get_route',
        data: _this.json2Form(parma),
        header: {
          'Content-Type': 'application/x-www-form-urlencoded', // 默认值
        },
        success: function (res) {
          //服务器返回数据
          if (res.statusCode == 200) {
            resolve(res);
          } else {
            //返回错误提示信息
            reject(res.data);
          }
        },
        fail: function (e) {
          reject(e);
          wx.showToast({
            title: '无法连接服务器',
            icon: 'loading',
            duration: 1000
          })
          // reject('网络出错');
        }
      });
    });

  }
}

// class PoiTypes{
//   constructor() {
//     this.lift = "lift";
//     this.washroom = "washroom";
//     this.parking = "parking";
//     this.room = "room";
//   }
// }

class PoiMarker{
  constructor(pois, baseIconPath) {
    this.pois = pois;
    this.baseIconPath = baseIconPath;
    this.markers = null;
    this.markersMapScale= this.initMarkerMapscal();
  }

  initMarkerMapscal(){
    return {
      1:[],
      2:[],
      3:[],
      4:[],
    }
  }

  addToMarkerMapscale(mapscale,marker){
    if (mapscale < 0 || mapscale>4 ) return;
    if (!marker) return;
    this.markersMapScale[mapscale].push(marker);
  }

  poi2Marker(poi,id){
    var iconPath = this.baseIconPath  + poi.poi_type+".png";
    var size = 20;
    var anchor ={x:.5,y:1};
    var marker = {
      iconPath: iconPath,
      id: id,
      latitude: poi.latitude,
      longitude: poi.longitude,
      width: size,
      height: size,
      anchor: anchor,
      title:poi.title,
    }
    return marker;
  }

  pois2Markers(){
    var pois = this.pois;
    if(!pois) return null;
    var markers = [];
    for (var i = 0;i< pois.length;i++){
      var markerID = i+10;
      var marker = this.poi2Marker(pois[i], markerID);
      pois[i].markerID = markerID;
      markers.push(marker);
      this.addToMarkerMapscale(pois[i].map_scale, marker);
    }
    return markers;
  }
}

//解决回调函数异步执行的问题
function wxPromisify(fn) {
  return function (obj = {}) {
    return new Promise((resolve, reject) => {
      obj.success = function (res) {
        resolve(res)
      }

      obj.fail = function (res) {
        reject(res)
      }

      fn(obj)//执行函数，obj为传入函数的参数
    })
  }
}
//添加映射
module.exports = {
  formatTime: formatTime,
  Point: Point,
  Vector2D: Vector2D,
  Vector3D: Vector3D,
  Route: Route,
  Coordinate: Coordinate,
  RouteManager: RouteManager,
  Heading: Heading,
  Attitude: Attitude,
  Acceleration: Acceleration,
  lngLatToXY: lngLatToXY,
  XYTolngLat: XYTolngLat,
  SensorMonitorManager:SensorMonitorManager,
  Beacon:Beacon,
  BeaconRegionConstrains: BeaconRegionConstrains,
  NavigationState: NavigationState,
  AccelerationManager: AccelerationManager,
  APIManager: APIManager,
  Poi:Poi,
  PoiMarker: PoiMarker,
}
