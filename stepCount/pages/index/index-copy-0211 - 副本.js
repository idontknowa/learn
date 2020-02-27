//index.js
//获取应用实例
var coordTrans = require('../../utils/coordinateTransform.js')  ;
var resoureData = require('../resource/data/ibeacon.js');
var util = require('../../utils/util.js');
var _mpower = 59;
var _envn = 2;
//var RouteManager = require('../../utils/RouteManager.js') ;
const app = getApp();

Page({
  data: {
    ax:0,
    ay:0,
    az:0,
    a:0,
    alpha:0,
    beta:0,
    gamma:0,
    stepCount:0,
    attitude:new util.Attitude(0,0,0),
    zAcceleration:"",
    lastzAcceleration:1,
    period:0,
    PEAK_VALUE:0.6,
    AcceleArray:[],
    FliterArray: [],
    prePeakTime :0,
    peakvalues:[],
    FliterWindow:5,
    PeakThreshold:1.1,
    heading:"",
    headingAccuracy:"",
    //存储的都是wgs84的坐标
    startP: new util.Coordinate(118.91101234583557, 32.11720326101012,"099"),
    currentP: new util.Coordinate(118.91101234583557, 32.11720326101012, "099"),
    StrideLength:0.55,
    navigationRoutes:"",
    polyline: [{
      points: [],
      color:"#FF0000",
      width: 2,
      dottedLine: false,
    }],
    markers:[],
    nearestBeacon:"",
    beacons:"",
    sensorMonitor:"",
    NearestBeaconTimer:"",
    AccuracyTimerName:"",
    drTimer:"",
    latitude: 29.968023,
    longitude: 122.290627, 
    navigationState: new util.NavigationState(),
    lastLocation:null,
    nowLocation: new util.Coordinate(122.290627, 29.968023,"099"),
    routeManager:null,
    locationMethod:"gps",
    updateAccuracy:0,
    lastBeaconUpdateTime:0,
  },

  //事件处理函数
  bindViewTap: function() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse){
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }

    //this.snap();

   
  },
  getUserInfo: function(e) {
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  
  startlisene:function(e){
    var _this = this;
    var timestamp = Date.parse(new Date());
    var routes = TestNavigationRoutes();
    this.data.routeManager = new util.RouteManager(routes);
    var polyline = Routes2Polyline(routes);
    this.setData({
      prePeakTime: timestamp,
      curPeakTime: timestamp,
      navigationRoutes:routes,
      polyline:polyline,
    });

    wx.startAccelerometer({
      interval: 'game'
    });
    wx.startCompass();
    wx.startDeviceMotionListening({
      interval: 'game'
    });
    wx.startLocationUpdate();
    wx.onDeviceMotionChange(function (res) {
      var attitude = new util.Attitude(res.alpha,res.beta,res.gamma);
      _this.setData({
        attitude: attitude,
      })
      });
    //wx.onAccelerometerChange(this.zAcceleration);
    this.setDRTimer();
    wx.onCompassChange(function (res) {
      _this.setData({
      heading: res.direction,
      headingAccuracy: res.accuracy ,
    })
    });
    wx.onLocationChange(this.onLocationChangeFunc);
    this.snap();
  },

navigation:function(e){
  
  var routes = TestNavigationRoutes();
  this.data.routeManager = new util.RouteManager(routes);
  var polyline = Routes2Polyline(routes);
  this.setData({
    navigationRoutes: routes,
    polyline: polyline,
  });
  this.setData({
    navigationRoutes:routes,
  });
  this.snap();
},

zAcceleration:function(res){
  //console.log(this.data.navigationState.startDeadReckoning);
  if (!this.data.navigationState.startDeadReckoning) return ;
  var attitude = this.data.attitude;
  var zAcceleration =
    res.x * (Math.sin(attitude.roll) * Math.cos(attitude.pitch)) +
    res.y * (-Math.sin(attitude.pitch)) +
    res.z * (Math.cos(attitude.roll) * Math.cos(attitude.pitch));
  this.data.zAcceleration = zAcceleration;
  var previous = this.data.lastzAcceleration;
  var current = LowPassFilter(previous,zAcceleration);
  this.data.lastzAcceleration = current;
  if (current > previous) {
    this.data.period++;
  }
  else {
    if (this.data.period > 3 && previous > this.data.PEAK_VALUE) {
      console.log(previous);
      var newstepcount = this.data.stepCount + 1;
      this.setData({
        stepCount: newstepcount,
      });
     //更新点
     this.data.locationMethod="dr"
     console.log("dr");
      var nextP = NextPosition(this.data.nowLocation, this.data.StrideLength, this.data.heading);
      this.deadReckoningUpdateLocation(nextP);
      
      }

      this.data.period = 0;
    }
  
  },


  start:function(e){
    var _this = this;
    var timestamp = Date.parse(new Date());
    _this.setData({
      prePeakTime: timestamp,
      curPeakTime: timestamp,
    });
    wx.startAccelerometer({
      interval: 'game'
    });
    wx.onAccelerometerChange(this.stepCount);
  },

  compass:function(e){
    var _this = this;
    wx.startCompass();
   
    wx.onCompassChange(function (res) {
      _this.setData({
        heading: res.direction,
        accuracy: res.accuracy,
      })
    })
  },


stepCount:function(res){ 
  var _this = this;
  var accList = _this.data.AcceleArray;
  var fliterList = _this.data.FliterArray;
  var a = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z);
  accList.push(a);

  _this.setData({
    ax: res.x,
    ay: res.y,
    az: res.z,
    a: a,
  });

  var timestamp = Date.parse(new Date());

  fliterList = MeanFilter(accList, fliterList, _this.data.windowLength);
  var PeakIndex = GetPeak(fliterList);
  var normalTimeD = false;
  var deltaTime = timestamp - _this.data.prePeakTime;
  if (deltaTime > 200) {
    normalTimeD = true;
  }

  if (PeakIndex != -1 && fliterList[PeakIndex] > _this.data.PeakThreshold && normalTimeD) {
    ///console.log(fliterList[PeakIndex])
    var IFRealPeak = true;
    var windowLength = 10;
    //var ifRealPeak = IFRealPeak(accList, PeakIndex, 10)

    //var length = fliterList.length;
    var left = 0;
    var right = length - 1;
    if (PeakIndex + windowLength < fliterList.length) {
      right = PeakIndex + windowLength
    }
    if (PeakIndex - windowLength > 0) {
      left = PeakIndex - windowLength
    }
    for (var i = left; i < right; i++) {
      if (fliterList[i] > fliterList[PeakIndex]) {
        IFRealPeak = false;
        break;
      }
    }

    if (IFRealPeak) {
      //console.log(accList[PeakIndex]);
      //更新上一个 波峰的时间
      //_this.curPeakTime = timestamp;
      _this.prePeakTime = timestamp;
      var newstepcount = _this.data.stepCount + 1;
      _this.setData({
        stepCount: newstepcount,
        prePeakTime: timestamp,
      })
      _this.data.peakvalues.push(fliterList[PeakIndex]);
      _this.updatePosition();
      // _this.data.stepCount += 1;
      accList.splice(0, PeakIndex)
      fliterList.splice(0, PeakIndex)


    }

    if (_this.data.peakvalues.length == 50){
      var minPeak = Math.min(this.data.peakvalues);
      if (minPeak > _this.data.PeakThreshold){
        _this.data.PeakThreshold = minPeak;
        _this.data.peakvalues=[];
      }
    }
  }

      _this.data.AcceleArray = accList;
},

  onLocationChangeFunc:function(res){
    const accuracy = res.accuracy;
    if (accuracyOfGPS(accuracy) >= this.data.navigationState.updateAccuracy){
      this.locationMethod ="gps";
      var location = new util.Coordinate(res.longitude,res.latitude,"099");
      this.updateLocation(location);
      //重新使用gps定位后 当前的beacon清空
      this.data.navigationState.nowNearestBeacon= null;
    }


  },
  
  snap:function(){
    var zoom = 19;
    var beaconArray = initBeaconData();
    this.data.beacons = beaconArray;
    var uuids = getUUIDs(beaconArray);
    var range = "";
    // console.log(beaconArray);
    // console.log(uuids);
    var distanceConvertor = function (rssi) {
      return Math.pow(10, (Math.abs(rssi) - 59) / 10 / 3);
    };

    var sensorMonitor = new util.SensorMonitorManager(zoom, distanceConvertor, range);

    this.data.sensorMonitor = sensorMonitor;

    // var updateNearestBeaconTimer = "";
    this.setNearestBeaconTimer();
    var _this = this;

    sensorMonitor.scheduleCalculationTimer();

    //this.resetSnap();

    wx.startBeaconDiscovery({
      uuids: Array.from(uuids),
      success: function (res) {
        // console.log(res);
        // 监听iBeacon信号
        wx.onBeaconUpdate(function (res) {
          var time = new Date();
          console.log("ibeacon saomiao gengxin " +(time - _this.data.lastBeaconUpdateTime));
          _this.data.lastBeaconUpdateTime = time;
          wx.getBeacons({
            success: function (res) {
              var time = new Date();
              console.log("res:" + res.beacons);
              
              sensorMonitor.updateBeaconsOnBeaconChange(res.beacons);
              // var _beacons = res.beacons;
              // for (var i in _beacons){
              //   var constrains = new util.BeaconRegionConstrains(_beacons[i].uuid);
              //   sensorMonitor.updateBeacons(res.beacons, constrains)
              // }
              console.log("更新ibeacon的时间"+ (new Date() - time));
            }
          })

          console.log("onbeaconupdate  " + (new Date() - time) );
        });
      }
    });
    

    
  },

  resetSnap:function(){
    this.invalidateNearestBeaconTimer();
    this.setNearestBeaconTimer();
  },

  //更新最近的ibeacon的时间戳
  invalidateNearestBeaconTimer:function(){
    clearInterval(this.data.NearestBeaconTimer);
    this.data.NearestBeaconTimer=null;
  },

  setNearestBeaconTimer: function () {
    var _this = this;
    this.NearestBeaconTimer = setInterval(function () {
      //_this.updateBeaconMarker();
      _this.updateNearestBeacon();
    }, 5000);
  },

  invalidateDRTimer: function () {
    clearInterval(this.data.drTimer);
    this.data.drTimer = null;
  },

  setDRTimer:function(){
    var _this = this;
    this.data.drTimer = setInterval(function () {
      var time = new Date();
      //_this.updateBeaconMarker();
      if (!_this.data.navigationState.startDeadReckoning) return;
      _this.data.locationMethod = "dr"
      var newstepcount = _this.data.stepCount + 1;
      _this.setData({
        stepCount: newstepcount,
      });
      var nextP = NextPosition(_this.data.nowLocation, _this.data.StrideLength, _this.data.heading);
      _this.deadReckoningUpdateLocation(nextP);
      console.log("dr Time function  " +(new Date()  - time));
    }, 1000);
  },


  invalidateAccuracyTimerLoop: function () {
    // clearTimeout(this.data.AccuracyTimerName);
    // this.data.AccuracyTimerName =null;
    this.data.navigationState.accuracyTimerLoop = 30;
  },

  setAccuracyTimerLoop:function(){
    
    var _this=this;
    this.AccuracyTimerName = setInterval(function () {
      console.log(new Date() + "diaoyong timee" + _this.data.navigationState.updateAccuracy);
      _this.data.navigationState.accuracyTimerLoop -=1;
      if (_this.data.navigationState.accuracyTimerLoop == 0){
        _this.data.navigationState.updateAccuracy-=1;
        _this.invalidateAccuracyTimerLoop();
      }
    }, 1000);
  },

  resetAccuracyTimerLoop:function(){
    this.invalidateAccuracyTimerLoop();
    //this.setAccuracyTimerLoop();
  },
  

  
  updateNearestBeacon:function(){
    // if (!this.data.sensorMonitor.nearestBeaconData) return;
    // var uuid = this.data.sensorMonitor.nearestBeaconData.UUID;
    // var location = beaconToLocation(this.data.beacons, uuid);

    // this.updateLocation(location);
    console.log(this.data.sensorMonitor.nearestBeaconData.UUID+this.data.sensorMonitor.nearestBeaconDistance);

    if (this.data.sensorMonitor.nearestBeaconData&&!this.data.sensorMonitor.nearestBeaconData.isEqual(this.data.navigationState.nowNearestBeacon) && this.data.sensorMonitor.nearestBeaconDistance< 8){
      console.log("new beacon location");
      //this.data.nearestBeacon = this.data.sensorMonitor.nearestBeaconData;
      this.data.navigationState.nowNearestBeacon = this.data.sensorMonitor.nearestBeaconData;
      this.data.locationMethod="beacon";
      this.data.navigationState.updateAccuracy=3;
      //this.data.navigationState.setUpdateAccuracy(3)
      var uuid = this.data.navigationState.nowNearestBeacon.UUID;
      var location = beaconToLocation(this.data.beacons, uuid);
      
      this.updateLocation(location);
      
    }
  },
  
  updateLocation: function (location) {
    if (!location) return;
    
    this.data.lastLocation = this.data.nowLocation;
    this.data.nowLocation = location;


    //更新精确度时间循环监听
    this.resetAccuracyTimerLoop();
    //修改是否需要开启DR
    this.setStartDeadReckoningValue();

    this.mapmatching();
    //this.updateLocationMarker();
  },
  
  deadReckoningUpdateLocation: function (location) {
    // console.log(this.data.routeManager.routes);
    if (!location) return;
    this.data.lastLocation = this.data.nowLocation;
    this.data.nowLocation = location;
    this.resetAccuracyTimerLoop();
    this.mapmatching();
    
  },


  setStartDeadReckoningValue() {
    if (this.data.navigationState.updateAccuracy>=2){
      this.data.navigationState.startDeadReckoning=true;
    }
    else{
      this.data.navigationState.startDeadReckoning=false;
    }
  },

  updateLocationMarker:function(){
    var location = this.data.nowLocation;
    if (!nearestBeacon) return;
    // console.log(location);
    var gcj02 = coordTrans.transformFromWGSToGCJ(location.latitude, location.longitude);
    var _markers  = [{
        iconPath: "../resource/images/location.png",
        id: 1,
        latitude: gcj02["latitude"],
        longitude: gcj02["longitude"],
        width: 20,
        height: 20,
    }];
    this.setData({
        markers:_markers,
      });
  },

  mapmatching: function (){
    this.setData({updateAccuracy:this.data.navigationState.updateAccuracy});
    // console.log(this.data.locationMethod);
    var nextP = this.data.nowLocation;
    // if (!nextP) return;
    // var routes = this.data.navigationRoutes;
    // var routeManger = new util.RouteManager(routes);
    var routeManger = this.data.routeManager;
    var nearestRoute = "";
    var heading = this.data.heading;
    if (heading == "") {
      nearestRoute = routeManger.getNearestRouteWithoutHeading(nextP);
    }
    else {
      nearestRoute = routeManger.getNearestRouteWithHeading(nextP, new util.Heading(heading));
    }



    // var nearestRoute = routeManger.getNearestRouteWithoutHeading(nextP);
    var mapmatchingPoint = routeManger.intersectingCoordinateFrom(nextP, nearestRoute);
    if (!mapmatchingPoint) return;
    // var gcj02mapmatching = coordTrans.transformFromWGSToGCJ(mapmatchingPoint.latitude, mapmatchingPoint.longitude);

    // var gcj02curposition = coordTrans.transformFromWGSToGCJ(nextP.latitude, nextP.longitude);
    var iconPath = "../resource/images/"+ this.data.locationMethod+".png";
    //console.log(iconPath);

    var _markers = [{
      iconPath: iconPath,
      id: 0,
      latitude:mapmatchingPoint.latitude,
      longitude: mapmatchingPoint.longitude,
      width: 20,
      height: 20,
    },
     {
      iconPath: "../resource/images/location.png",
      id: 1,
      latitude: nextP.latitude,
      longitude: nextP.longitude,
      width: 20,
      height: 20,}
    ];
    //console.log(mapmatchingPoint, gcj02curposition);
    this.setData({
      markers: _markers,
    });
  },

  updatePosition:function(){
    //console.log(this.data.heading);
    var nextP = NextPosition(this.data.currentP,this.data.StrideLength,this.data.heading);
    this.data.currentP = nextP;
    var routes = this.data.navigationRoutes;
    var routeManger = new util.RouteManager(routes);
    var nearestRoute="";
    var heading = this.data.heading;
    if (heading == ""){
      nearestRoute = routeManger.getNearestRouteWithoutHeading(nextP);
    }
    else{
      nearestRoute = routeManger.getNearestRouteWithHeading(nextP,new util.Heading(heading));
    }


    
    var nearestRoute = routeManger.getNearestRouteWithoutHeading(nextP);
    var mapmatchingPoint = routeManger.intersectingCoordinateFrom(nextP, nearestRoute); 
    var gcj02mapmatching = coordTrans.transformFromWGSToGCJ(mapmatchingPoint.latitude, mapmatchingPoint.longitude);

    var gcj02curposition = coordTrans.transformFromWGSToGCJ(nextP.latitude, nextP.longitude);
    var _markers = [{
      iconPath: "../resource/images/navigation.png",
      id: 0,
      latitude: gcj02mapmatching["latitude"],
      longitude: gcj02mapmatching["longitude"],
      width: 20,
      height: 20,
    },
    {
      iconPath: "../resource/images/location.png",
      id: 1,
      latitude: gcj02curposition["latitude"],
      longitude: gcj02curposition["longitude"],
      width: 20,
      height: 20,
    }
    ];
    //console.log(mapmatchingPoint, gcj02curposition);
    this.setData({
     markers:_markers,});

    // var gcj02P = coordTrans.transformFromWGSToGCJ(nextP.latitude, nextP.longitude);
    // var polylinePoint = { latitude: gcj02P["latitude"], longitude: gcj02P["longitude"] };
    // //console.log(polylinePoint);
    // //console.log(this.data.polyline[0]["points"]);
    // var points = this.data.polyline[0]["points"];
    // points.push(polylinePoint);
    // var polyline = this.data.polyline;
    // this.setData({
    //   polyline: [{
    //     points: points,
    //     color: "#FF0000",
    //     width: 2,
    //     dottedLine: false}],
    // });
    
  },



  coordTransTest:function(e){
    // var longitude = 118.916359 ;
    // var latitude = 32.114263 ;
    // var gcj022wgs84 = coordTrans.transformFromGCJToWGS(latitude,longitude);
    // console.log(gcj022wgs84,"gcj2wgs");
    // var wgs2gcj = coordTrans.transformFromWGSToGCJ(gcj022wgs84["latitude"], gcj022wgs84["longitude"]);
    // console.log(wgs2gcj, "wgs2gcj");
    // var xycoord = lngLatToXY({x:longitude,y:latitude});
    // console.log(xycoord, "xy2lon");
    // var latlng = XYTolngLat(xycoord);
    // var latlng = XYTolngLat(xycoord);
    // console.log(latlng, "lon2xy" )

    //地图匹配测试
    //类测试
    // var coordinate1 = new util.Coordinate(118.423423,32.1164, "099");
    // var coordinate2 = new util.Coordinate(118.423433,32.1164, "099");
    // var coordinate3 = new util.Coordinate(118.423443, 32.1164, "099");

    // var xy = coordinate1.toXY();
    // var route = new util.Route(coordinate1,coordinate2,"099",0);
    // var length = route.length();

    // console.log(coordinate1);
    // console.log(xy);
    // console.log(route);
    // console.log(length);
    
    // var coordinate1 = new util.Coordinate(118.9110533, 32.11699319, "099");
    // var coordinate2 = new util.Coordinate(118.9111533, 32.11699319, "099");
    // var coordinate3 = new util.Coordinate(118.9112533, 32.11699319, "099");
    // var vector = new util.Vector2D(coordinate1.longitude-coordinate2.longitude,coordinate1.latitude-coordinate2.latitude);
    // console.log(vector.direction());
    // var curPosition = new util.Coordinate(118.9111733, 32.11689329,"099");
    // var route = new util.Route(coordinate1, coordinate2, "099", 0);
    // var route2 = new util.Route(coordinate2, coordinate3, "099", 0);
    // var routes = new Array(route, route2);
    // var routeManger = new util.RouteManager(routes);
    // var nearestRoute = routeManger.getNearestRouteWithoutHeading(curPosition);
    // var mapmatchingPoint = routeManger.intersectingCoordinateFrom(curPosition,nearestRoute); 
    // console.log(nearestRoute);
    // var mapmatchingLine = new util.Route(curPosition, mapmatchingPoint, "099", 0);
    // var gcj02mapmatching = coordTrans.transformFromWGSToGCJ(mapmatchingPoint.latitude, mapmatchingPoint.longitude);

    // var gcj02curposition = coordTrans.transformFromWGSToGCJ(curPosition.latitude, curPosition.longitude);
    // var _markers = [{
    //   iconPath: "../resource/images/navigation.png",
    //   id: 0,
    //   latitude: gcj02mapmatching["latitude"],
    //   longitude: gcj02mapmatching["longitude"],
    //   width: 20,
    //   height: 20,
    // },
    //   {
    //     iconPath: "../resource/images/location.png",
    //     id: 1,
    //     latitude: gcj02curposition["latitude"],
    //     longitude: gcj02curposition["longitude"],
    //     width:20,
    //     height:20,
    //   }
    // ];

    // var polyline = Routes2Polyline(routes);
    // console.log(polyline);
    // this.setData({
    //   polyline:polyline,
    //   markers: _markers,
    // })
    // console.log(7/2);
    // var arr = [1,2,3];
    // var [...arr2] =arr;
    // console.log(arr2); 
    // var map = new Map();
    // map.set("1", "1");
    // map.set("2", "1");
    // map.set("3", "1");
    // for (var [key, value] of map){
    //   console.log(key,value);
    // }
    // var _this = this;

    // let SensorMonitorNearestBeaconChange = {
    //   get: function (obj, prop, value) {
    //     if (prop === 'nearestBeaconData') {
    //       _this.data.a = obj[prop];
    //       return obj[prop];
    //     }
    //     return null;
    //   }
    // };
    // console.log(this.data.a);

    // let SensorMonitor = new Proxy(new util.SensorMonitorManager(), SensorMonitorNearestBeaconChange);
    // SensorMonitor.nearestBeaconData = "fs";
    // console.log(_this.data.a);
    this.setAccuracyTimerLoop();
    this.invalidateAccuracyTimerLoop();



     }


})

function AddPropChangeListen(){
  1;
}

function GetPeak(ArrayList){
  var minPeakValue = 0.5;
  for (var i = ArrayList.length - 2 ; i > 0 ;i--){
  //for (var i = 1; i < ArrayList.length-1; i++) {
    if (ArrayList[i - 1] < ArrayList[i] && ArrayList[i + 1] < ArrayList[i] && ArrayList[i] > minPeakValue)
      return i;
  }
  return -1;
}

function MeanFilter(AccList,FilterList, window) {
  var length = AccList.length;
  FilterList.push(AccList[length - 1]);
  if (length < window) {
    return FilterList;
  }
  var sum = 0.0
  for (var i = 1; i <= window; i++) {
    sum += AccList[length - i];
  }
  FilterList[length - window / 2 - 1] = sum / window;
  return FilterList;
}


function LowPassFilter(pre,cur){
  var PeakRate = 1/1.5
  return PeakRate * cur + (1-PeakRate)* pre
}


function Direction2Radian(direction){
  return 2*Math.PI*((450-direction)/360.0);
}

function NextPosition(preP, StrideLength, direction) {
  var radianD = Direction2Radian(direction);
  var _xyP = util.lngLatToXY(preP);
  var deltaX = StrideLength * Math.cos(radianD);
  var deltaY = StrideLength * Math.sin(radianD);
  var _newxyP = new util.Point(_xyP.x+deltaX,_xyP.y+deltaY,_xyP.levelcode);
  return _newxyP.toLngLat();
}


function Routes2Polyline(routes){
 
  var points =[]
  for (var i in routes){
    var route = routes[i];
    // var startgcj = coordTrans.transformFromWGSToGCJ(route.start.latitude, route.start.longitude);
    // var endgcj = coordTrans.transformFromWGSToGCJ(route.end.latitude, route.end.longitude);
    // var point1 = { latitude: startgcj["latitude"], longitude: startgcj["longitude"]};
    // var point2 = { latitude: endgcj["latitude"], longitude: endgcj["longitude"] };
    points.push(route.start);
    points.push(route.end);
  }
  var polyline = [{
    points: points,
    color: "#FF0000",
    width: 2,
    dottedLine: false,
  }];
  return polyline;
}

function TestNavigationRoutes() {
  // var p1 = new util.Coordinate(118.91101234583557, 32.11720326101012, "099");
  // var p2 = new util.Coordinate(118.911157224503, 32.11720326101012, "099");
  // var p3 = new util.Coordinate(118.911157224503, 32.1169261990423, "099");
  // var p4 = new util.Coordinate(118.91131211520101, 32.1169261990423, "099");
  var p1 = new util.Coordinate(122.290627, 29.968023, "099");
  var p2 = new util.Coordinate(122.290547, 29.968023, "099");
  var p3 = new util.Coordinate(122.290547, 29.967916, "099");
  var p4 = new util.Coordinate(122.290638, 29.967916, "099");
  var route1 = new util.Route(p1, p2, "099", 0);
  var route2 = new util.Route(p2, p3, "099", 0);
  var route3 = new util.Route(p3, p4, "099", 0);
  var routes = new Array(route1, route2, route3);
  //var RM = new util.RouteManager(routes);
  return routes;
}

function initBeaconData() {
  var ibeaconResource = resoureData.beacondata["tiles"];
  var beacons = new Array();
  for (var tileIndex in ibeaconResource){
    var tile = ibeaconResource[tileIndex];
    for (var beaconIndex in tile["beacons"] ){
      var beaconsDic = tile["beacons"][beaconIndex];
      var beaconObj = new util.Beacon();
      beaconObj.setObjectWithDict(beaconsDic);
      beacons.push(beaconObj);
    }
  }
  return beacons;

}

function getUUIDs(beacons){
  var uuids = new Set();
  for (var i in beacons){
    uuids.add(beacons[i].UUID);
  }
  return uuids;
}

function accuracyOfGPS(accuracy){
  if (accuracy <= 10){
    return 2;
  }
  else if (accuracy <= 30){
    return 1;
  }
  else{
    return 0;
  }
}

function beaconToLocation(beacons, uuid) {
  for (var i in beacons) {
    var beacon = beacons[i];
    if (uuid == beacon.UUID) {
      return new util.Coordinate(beacon.longitude,beacon.latitude,beacon.levelCode);
    }
  }
  return null;
}


