
class Point{
  constructor(x, y,levelcode){
    this.x = x;
    this.y = y;
    this.levelcode = levelcode;

    
  }
  x(){return this.x}
  y(){return this.y}
  toLngLat(){
    var res = XYTolngLat({ x: this.x, y: this.y });
    return new coordinate(res["x"],res["y"]);
  }
}

class Coordinate{
  constructor(x, y,levelcode) {
    this.longitude = x;
    this.latitude = y;
    this.levelcode = levelcode;

  }
  longitude() { return this.longitude }
  latitude() { return this.latitude}
  toXY() {
    var res = lngLatToXY({ x: this.x, y: this.y });
    return new Point(res["x"], res["y"]);
  }
}

class Vector2D{
  constructor(x, y) {
    this.x = x;
    this.y = y;

  }

  length(){
    return Math.sqrt(this.x*this.x + this.y*this.y)
  }
}

class Vector3D {
  constructor(x, y,z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y+ this.z*this.z)
  }
}

//添加映射
module.exports = {
  Point: Point,
  Vector2D: Vector2D,
  Vector3D:Vector3D
}
