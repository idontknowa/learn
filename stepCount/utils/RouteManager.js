

class Point {
  constructor(x, y,levelcode) {
    this.x = x;
    this.y = y;
    this.levelcode = levelcode;

  }
  x() { return this.x }
  y() { return this.y }
  toLngLat() {
    var res = XYTolngLat({ x: this.x, y: this.y });
    return new coordinate(res["x"], res["y"]);
  }
}

class Coordinate {
  constructor(x, y,levelcode) {
    this.longitude = x;
    this.latitude = y; 
    this.levelcode = levelcode;

  }
  longitude() { return this.longitude }
  latitude() { return this.latitude }
  toXY() {
    var res = lngLatToXY({ x: this.x, y: this.y });
    return new Point(res["x"], res["y"]);
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



class Route{
  constructor(start,end,levelcode,sequence) {
    this.start = start;
    this.end = end;
    this.levelcode = levelcode;
    this.sequence = sequence;
  }
  
  length(){

    return MetersBetweenMapCoordinates(this.start,this.end);

  }
}

class RouteManager{
  constructor(routes) {
    this.HEADING_FACTOR=10.0;
    this.DISTANCE_FACTOR= 40.0;
    this.navigationRoutes = routes;
  }
  //更新导航路径
  updateRoutesForNavigation(routes){
    this.navigationRoutes = routes;
  }
  //删除导航路径
  removeRoutesForNavigation(){
    this.navigationRoutes=null;
  }

  //public
  getNearestRouteWithoutHeading(point){
    return getNearestRouteForPoint(point,this.navigationRoutes);
  }

  //public
  getNearestRouteWithHeading(point,heading) {
    return getNearestRouteForNavigationFromPointWithHeading(point,heading, this.navigationRoutes);
  }
 //逻辑函数 寻找距离某点最近的路径 
  getNearestRouteForPoint(point,routes){
    var minDis = 999;
    for (var i = 0;i< routes.length;i++){
      var distance = distanceFromCoordinateRoute(point,routes[i]); 
    }
  }

  //在有手机朝向参数情况下使用 该情况下不能单纯使用距离点最近的路径 要考虑手机的朝向
  getNearestRouteForNavigationFromPointWithHeading(point,heading,routes) {
    var lastWeight = -999;

    var nearestRoute ;

    for (let route in routes) {
      //楼层不同的不计算
      if (route.levelcode != point.levelcode){
        continue;
      }

      var distanceWeight = distanceWeightFromPoint(point, route);
      var headingWeight = headingWeightToRoute(route,heading);
      var total = distanceWeight + headingWeight;
      if (lastWeight < total) {
        lastWeight = total;
        nearestRoute = route;
      }

    }
    return nearestRoute;
  }

  //
distanceWeightFromPoint(point,route){
  var distance = distanceFromCoordinate(point,route) ;
  var factor;
  if (distance > 160) {
    factor = 0.0;
  }
  else {
    factor = (80 - distance) / 80.0;
  }

  return factor * DISTANCE_FACTOR;
}

//根据朝向和路径计算权重
headingWeightToRoute(route,heading){
  if (!heading) return 0;
  return vectorBasedWeightToRoute(route,heading);
}

  vectorBasedWeightToRoute(route, heading){
    //heading类
    var trueHeading = heading.trueHeading;
    //路的朝向
    var routeHeading = headingFrom(route.start,route.end);
    //用cos/sin 表示朝向单位向量
    var trueVector = new Vector2D(sin(DEGREE_TO_RADIUS(trueHeading)), cos(DEGREE_TO_RADIUS(trueHeading)));
    //道路的单位向量
    var routeVector = new Vector2D(sin(DEGREE_TO_RADIUS(routeHeading)), cos(DEGREE_TO_RADIUS(routeHeading)));
    //  一个新矢量，其分量分别表示在两个源矢量的相同位置上找到的分量之间的差异。
    var vector = new Vector2D(trueVector.x - routeVector.x, trueVector.y - routeVector.y);
    //GLKVector2Subtract(trueVector, routeVector);
    //返回vector向量的长度
    var length = vector.length();
    //长度的平方
    var len2 = Math.pow(length, 2);                  // 0 - 4, 2 is in the middle
    var adjusted = len2 > 2 ? 4 - len2 : len2;  // 0 - 2
    var factor = (2 - adjusted) / 2.0;          // 0 - 1, 0 means vertical

    return factor * HEADING_FACTOR;   
  }

distanceFromCoordinate(coordinate,route)
{
  var intersectionCoordinate =intersectingCoordinateFrom(coordinate,route);
  return MetersBetweenMapCoordinates(coordinate, intersectionCoordinate);
}


  //计算点到线的距离  经纬度坐标
  distanceFromRoute(point,route){
    var intersection = intersectingCoordinateFrom(point,route);
    return MetersBetweenMapCoordinates(point, intersection);
  }

  //计算点和线的交点 若点在线段上的投影超出线段，则返回距离线段起点和终点中距离该点最近的点
  intersectingCoordinateFrom(coordinate,route){
    var start = route.start;
    var end = route.end;

    var a = (start.latitude - end.latitude);
    var b = (end.longitude - start.longitude);
    var c = (start.latitude * (start.longitude - end.longitude) - (start.longitude * (start.latitude - end.latitude)));
    
    var vector = new Vector3D(a,b,c);

    var longitude = (Math.pow(vector.y, 2) * coordinate.longitude - vector.x * vector.y * coordinate.latitude - vector.x * vector.z) / (Math.pow(vector.x, 2) + Math.pow(vector.y, 2));
    var latitude = (-vector.x * vector.y * coordinate.longitude + Math.pow(vector.x, 2) * coordinate.latitude - vector.y * vector.z) / (Math.pow(vector.x, 2) + Math.pow(vector.y, 2));

    var intersectCoordinate = new Coordinate(latitude, longitude);

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


//添加映射
module.exports = {
  Point: Point,
  Vector2D: Vector2D,
  Vector3D: Vector3D,
  Route: Route,
  Coordinate: Coordinate,
  RouteManager: RouteManager,
}