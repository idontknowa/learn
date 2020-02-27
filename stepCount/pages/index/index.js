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
    stepCount:0,
    zAcceleration:"",
    lastzAcceleration:1,
    period:0,
    PEAK_VALUE:1.05,
    peakvalues:[],
    heading:"",
    headingAccuracy:"",
    //存储的都是wgs84的坐标
    startP: new util.Coordinate(118.91101234583557, 32.11720326101012,"099"),
    currentP: new util.Coordinate(118.91101234583557, 32.11720326101012, "099"),
    StrideLength:1,
    polyline: [{
      points: [],
      color:"#FF0000",
      width: 2,
      dottedLine: false,
    }],
    markers:[],
    beacons:"",
    sensorMonitor:"",
    NearestBeaconTimer:"",
    AccuracyTimerName:"",
    latitude: 32.11706,
    longitude: 118.91112, 
    navigationState:null,
    lastLocation:null,
    nowLocation: null,//new util.Coordinate(122.290627, 29.968023,"099"),
    routeManager:"",
    locationMethod:"",
    updateAccuracy:0,
    lastBeaconUpdateTime:0,
    accelerationManager:"",

    suggestion:null,
    backfill:null,
    showOrHidden:true,
    onBackFill:false,
    showStartNavigation:false,

    pois:null,
    poiMarker:null,
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
    this.data.navigationState = new util.NavigationState();
    this.data.routeManager = new util.RouteManager();
    this.data.accelerationManager = new util.AccelerationManager();
    this.snap();
    this.addListen();
    this.loadPoi();
  },

  loadPoi:function(){
    var pois = initPoiData();
    var basePoiIconPath = "../resource/images/";
    var poiMarker = new util.PoiMarker(pois, basePoiIconPath);
    this.data.pois = pois;
    this.data.poiMarker = poiMarker;
    poiMarker.pois2Markers();
    var poiMarkers = poiMarker.markersMapScale[1];
    var _markers = this.data.markers;
    poiMarkers.concat(_markers);
    this.setData({
      markers: poiMarkers,}
    );
    console.log(this.data.markers);
  },

  getUserInfo: function(e) {
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },

  markerClick:function(e){
    var markerID = e["markerId"];
    var markers = this.data.markers;
    for (var i =0; i < markers.length;i++){
      var marker = markers[i];
      if (marker["id"] == markerID){
        var backfill = GetPoiByMarkerID(this.data.pois,markerID);
        this.setData({
          backfill:backfill,
        })

      }
    }
    console.log(this.data.backfill);
  },

  addListen:function(){
    var _this = this;
    wx.onAccelerometerChange(this.zAccelerationTest);
    wx.onCompassChange(function (res) {
      _this.data.heading = res.direction;
      var makers = UpdateMarkerRotate(_this.data.markers, 0, res.direction);
      _this.setData({ markers: makers,});
    });
    wx.onLocationChange(this.onLocationChangeFunc);
  },

  setpCount:function(){
    var _this = this;
    wx.startAccelerometer({
      interval: 'game'
    });
    wx.startCompass();
    wx.startDeviceMotionListening({
      interval: 'game'
    });
    wx.onDeviceMotionChange(function (res) {
      var attitude = new util.Attitude(res.alpha, res.beta, res.gamma);
      _this.data.attitude = attitude;
    });
    this.data.accelerationManager = new util.AccelerationManager();
    wx.onAccelerometerChange(this.zAccelerationTest);
  },
  
  startlisene:function(e){
    var _this = this;
    var timestamp = Date.parse(new Date());
    var routes = TestNavigationRoutes();
    this.data.routeManager.navigationRoutes= routes;
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
    
    // wx.startDeviceMotionListening({
    //   interval: 'game'
    // });

    wx.startLocationUpdate();

    // wx.onDeviceMotionChange(function (res) {
    //   var attitude = new util.Attitude(res.alpha,res.beta,res.gamma);
    //   _this.data.attitude = attitude;
    //   });
    // this.data.accelerationManager = new util.AccelerationManager();
    wx.onAccelerometerChange(this.zAccelerationTest);
   
    // this.setDRTimer();

    wx.onCompassChange(function (res) {
      _this.data.heading = res.direction;
    });
    // this.setRotationTimer();
    wx.onLocationChange(this.onLocationChangeFunc);
    // this.snap();
  },

  startNavigation:function(){
    wx.startAccelerometer({
      interval: 'game'
    });
    wx.startCompass();
    wx.startLocationUpdate();
    this.data.navigationState.startDeadReckoning=true;
    // this.snap();
  },
 

navigation:function(e){
  var _this = this;
  var nearestBeacon = this.data.navigationState.nowNearestBeacon;

  var startPoint = beaconToLocation(this.data.beacons, nearestBeacon.UUID);
  // var startPoint = new util.Coordinate(118.911125, 32.1170646, "103");
  if (!startPoint){
    wx.showToast({
      title: '无法获取您的位置',
    })
  }
  var endPoint = backFill2Point(this.data.backfill);
  
  // var endPoint = new util.Coordinate(118.91118018281698, 32.11717057107787,"099");
  //var routes = TestNavigationRoutes();
  var apiManager = new util.APIManager("http://118.31.57.210:81/apis/");
  console.log(startPoint, endPoint)
  var routes = apiManager.getRoutesFromCoordinate(startPoint,endPoint);
  routes.then(res => {
    console.log(res.data.nodes);
    var nodes = res.data.nodes;
    var nodes = Nodes2RoutesNodes(startPoint,endPoint,nodes);
    var routes = Nodes2Routes(nodes);
    var polyline = Nodes2Polyline(nodes);
    console.log(routes);
    console.log(_this.data.navigationState.startDeadReckoning);
    _this.data.routeManager = new util.RouteManager(routes);
    _this.setData({
      navigationRoutes: routes,
      polyline: polyline,
      showStartNavigation:true,
    });
    // _this.snap();
  });


  // this.data.routeManager = new util.RouteManager(routes);
  // var polyline = Routes2Polyline(routes);
  // this.setData({
  //   navigationRoutes: routes,
  //   polyline: polyline,
  //   showStartNavigation:true,
  // });
  // this.setData({
  //   navigationRoutes:routes,
  // });
  // this.snap();
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
     this.setData({
       locationMethod:"dr"
     })
     console.log("dr");
      var nextP = NextPosition(this.data.nowLocation, this.data.StrideLength, this.data.heading);
      this.deadReckoningUpdateLocation(nextP);
      
      }

      this.data.period = 0;
    }
  
  },
  zAccelerationTest: function (res) {
    if (!this.data.navigationState.startDeadReckoning) return;
    
    var zAcceleration = this.data.accelerationManager.updateAcceleration(res);
    this.data.zAcceleration = zAcceleration;

    // console.log(res.x*res.x + res.y*res.y+res.z*res.z);
    var previous = this.data.lastzAcceleration;
    var current = zAcceleration;
    // console.log(previous);
    // console.log(current);
    this.data.lastzAcceleration = current;
    if (current > previous) {
      this.data.period++;
    }
    else {
      if (this.data.period > 3 && previous > this.data.PEAK_VALUE) {
        
        var newstepcount = this.data.stepCount + 1;
        this.setData({
          stepCount: newstepcount,
        });
        //更新点
        this.data.locationMethod = "dr"
        this.setData({
          locationMethod: "dr"
        })
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

  onLocationChangeFunc:function(res){
    const accuracy = res.accuracy;
    if (accuracyOfGPS(accuracy) >= this.data.navigationState.updateAccuracy){
      this.data.locationMethod ="gps";
      this.setData({
        locationMethod: "gps"
      })
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
          wx.getBeacons({
            success: function (res) {
              sensorMonitor.updateBeaconsOnBeaconChange(res.beacons);
            }
          })
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
    this.data.NearestBeaconTimer = setInterval(function () {
      //_this.updateBeaconMarker();
      _this.updateNearestBeacon();
    }, 1000);
  },

  //更新最近的ibeacon的时间戳
  invalidateRotationTimer: function () {
    clearInterval(this.data.RotationTimer);
    this.data.NearestBeaconTimer = null;
  },

  setRotationTimer: function () {
    var _this = this;
    this.data.RotationTimer = setInterval(function () {
      //_this.updateBeaconMarker();
      _this.markerRotate();
    }, 1000);
  },

  markerRotate:function(){
    var markers = this.data.markers;
    var heading = this.data.heading;
    for (var i in markers){
      var marker = markers[i];
      if (marker["id"] == 0){
        marker["rotate"] = heading;
        return ;
      }
      
    }


  },

  invalidateDRTimer: function () {
    clearInterval(this.data.drTimer);
    this.data.drTimer = null;
  },

  setDRTimer:function(){
    var _this = this;
    this.data.drTimer = setInterval(function () {
      // var time = new Date();
      //_this.updateBeaconMarker();
      if (!_this.data.navigationState.startDeadReckoning) return;
      _this.data.locationMethod = "dr"
      _this.setData({
        locationMethod: "dr"
      })
      var newstepcount = _this.data.stepCount + 1;
      _this.setData({
        stepCount: newstepcount,
      });
      var nextP = NextPosition(_this.data.nowLocation, _this.data.StrideLength, _this.data.heading);
      _this.deadReckoningUpdateLocation(nextP);
      // console.log("dr Time function  " +(new Date()  - time));
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
      // console.log(new Date() + "diaoyong timee" + _this.data.navigationState.updateAccuracy);
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
    
    if (this.data.sensorMonitor.nearestBeaconData&&!(this.data.sensorMonitor.nearestBeaconData.isEqual(this.data.navigationState.nowNearestBeacon)) && this.data.sensorMonitor.nearestBeaconDistance< 4){
      console.log("new beacon location");
      //this.data.nearestBeacon = this.data.sensorMonitor.nearestBeaconData;
      this.data.navigationState.nowNearestBeacon = this.data.sensorMonitor.nearestBeaconData;
      this.data.locationMethod="beacon";
      this.setData({
        locationMethod: "beacon"
      })
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
    if (!this.data.navigationState.startDeadReckoning) return;

    if (this.data.navigationState.updateAccuracy>=2){
      this.data.navigationState.startDeadReckoning=true;
    }
    else{
      this.data.navigationState.startDeadReckoning=false;
    }
  },

  mapmatching: function (){
    
    var nextP = this.data.nowLocation;
    var _markers = this.data.markers;
    
    var routeManger = this.data.routeManager;
    if (routeManger.navigationRoutes){
      var nearestRoute = "";
      var heading = this.data.heading;

      if (heading == "") {
        nearestRoute = routeManger.getNearestRouteWithoutHeading(nextP);
      }
      else {
        nearestRoute = routeManger.getNearestRouteWithHeading(nextP, new util.Heading(heading));
      }
      var mapmatchingPoint = routeManger.intersectingCoordinateFrom(nextP, nearestRoute);
      if (!mapmatchingPoint) return;
      var iconPath = "../resource/images/" + this.data.locationMethod + ".png";
      _markers = UpdateMarkers(_markers, mapmatchingPoint, 0, iconPath);
    }
    else{
      var iconPath="../resource/images/location.png";
      _markers = UpdateMarkers(_markers, nextP, 1, iconPath);
    }
    this.setData({
      markers: _markers,
    });
  },



  coordTransTest:function(e){
    var _this = this;
    var type = "room";
    var text = "车位";
    // getPOI(type, text);
    var apiManager = new util.APIManager("http://118.31.57.210:81/apis/");
    var suggestion = apiManager.getPOIsWithType(type, text);
    console.log(suggestion);
    suggestion.then(res => {
      var pois = res.data.pois;
      var suggestions = [];
      console.log(pois.length);
      for (var i in pois) {
        var poi = new util.Poi();
        poi.setObjectWithDict(pois[i]);
        suggestions.push(poi);
      }
      _this.setData({
        suggestion: suggestions,
      });
      return suggestions;
      
       }).catch(res=>{
         console.log(res);
       });
  },

  backfill: function (e) {
    var _markers = this.data.markers;
    var id = e.currentTarget.id;
    for (var i = 0; i < this.data.suggestion.length; i++) {
      if (i == id) {
        this.setData({
          backfill: this.data.suggestion[i],
          showOrHidden:false,
          onBackFill:true,
        });
        var iconPath = "../resource/images/mapmatching.png"
        // var marker = [{
        //   iconPath: "../resource/images/location.png",
        //   id: 1,
        //   latitude: this.data.suggestion[i].latitude,
        //   longitude: this.data.suggestion[i].longitude,
        //   width: 20,
        //   height: 20,
        // }];
        _markers = UpdateMarkers(_markers, this.data.suggestion[i], 2, iconPath);
        this.setData({
          markers: _markers,
        });
      }
    }
  },

  getsuggest: function (e) {
    var showOrHide = !this.data.onBackFill;
    this.setData({
      showOrHidden: showOrHide,
      onBackFill:false,
      showStartNavigation:false,
    });
    var type = "room";
    var text = e.detail.value;
    console.log(text);
    if (!text) {
      this.setData({
        suggestion: null,
      })
      return;
    }
    var _this = this;
    var apiManager = new util.APIManager("http://118.31.57.210:81/apis/");
    var suggestion = apiManager.getPOIsWithType(type, text);
    console.log(suggestion);
    suggestion.then(res => {
      var pois = res.data.pois;
      var suggestions = [];
      for (var i in pois) {
        var poi = new util.Poi();
        poi.setObjectWithDict(pois[i]);
        suggestions.push(poi);
      }
      _this.setData({
        suggestion: suggestions,
      });
      return suggestions;

    }).catch(res => {
      console.log(res);
    });
  }
})


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

function Nodes2Polyline(nodes) {
  var polyline = [{
    points: nodes,
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


  var p1 = new util.Coordinate(122.290841, 29.968225, "099");
  var p2 = new util.Coordinate(122.290841, 29.968295, "099");
  var p3 = new util.Coordinate(122.290728, 29.968295, "099");
  var p4 = new util.Coordinate(122.290728, 29.968225, "099");
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

function initPoiData() {
  var poiResource = resoureData.poiData;
  var pois = new Array();
  for (var i in poiResource) {
    var poi = new util.Poi();
    poi.setObjectWithDict(poiResource[i]);
    pois.push(poi);
    
  }
  return pois;

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
    if (uuid.toLowerCase() == beacon.UUID.toLowerCase()) {
      return new util.Coordinate(beacon.longitude, beacon.latitude, beacon.levelCode);
    }
  }
  return null;
}

function Beacon2Marker(beacons){
  var markers = [];
  var iconPath = "../resource/images/ibeacon.png";
  for (var i in beacons){
    var marker = {
      iconPath: iconPath,
        id: i+3,
      latitude: beacons[i].latitude,
      longitude: beacons[i].longitude,
      width: 20,
       height: 20,
    };
    markers.push(marker);

  }
  return markers;
}
function json2Form(json) {
  var str = [];
  for (var p in json) {
    str.push(encodeURIComponent(p) + "=" + encodeURIComponent(json[p]));
  }
  console.log(str.join("&"));
  return str.join("&");
  
}

function getPOI(type,text){
  var data = {
    type: type,
    text: text
  };
  wx.request({
    method: 'POST',
    url: 'http://118.31.57.210:81/apis/poi_search', 
    data: json2Form(data),
    header: {
      'Content-Type': 'application/x-www-form-urlencoded', // 默认值
    },
    success:function(res){
      console.log(res.data);
    },
    fail:function(res){
      console.log(res);
    }
  })
}


function backFill2Point(backfill){
  return new util.Coordinate(backfill["longitude"],backfill["latitude"],backfill["level_code"]);

}

function UpdateMarkers(markers,location,id,iconPath){
  console.log(iconPath);
  if ((!iconPath)||iconPath.length == 0){
    iconPath = "../resource/images/location.png"
  }
  for (var i = 0 ;i < markers.length;i++){
    if ( markers[i]["id"] == id){
      markers[i]["longitude"] = location.longitude;
      markers[i]["latitude"] = location.latitude;
      markers[i]["iconPath"] = iconPath;
      return markers;
    }
  }
  var anchor = {x:0.5,y:1};
  var size = 20;
  if (id == 0){
    anchor = { x: 0.5, y: 0.5 }
    size = 10;
  }
  var marker = {
    iconPath: iconPath,
    id: id,
    latitude: location.latitude,
    longitude: location.longitude,
    width: size,
    height:size,
    anchor: anchor,
  };
  markers.push(marker);
  return markers;

}

function UpdateMarkerRotate(markers, id, rotate) {
  if (!markers) return markers;
  
  for (var i = 0; i < markers.length; i++) {
    if (markers[i]["id"] == id) {
      markers[i]["rotate"] = rotate;
      return markers;
    }
  }
  return markers;

}

function Nodes2RoutesNodes(startPoint,endPoint,nodes){
  var resNodes = [];
  //var routesManger = util.RouteManager();
  var nodesCoordinate =[];
  var routesManger = new util.RouteManager();
  resNodes.push(startPoint);
  for (var i in nodes) {
    var node = new util.Coordinate(parseFloat(nodes[i]["lon"]), parseFloat(nodes[i]["lat"]), nodes[i]["level"]);
    resNodes.push(node);
  }

  resNodes.push(endPoint);
  // for (var i = 0; i< nodesCoordinate.length;i++){
  //   if (i == 0 ){
  //     var start = nodesCoordinate[i];
  //     var end = nodesCoordinate[i+1];
  //     var intersect = routesManger.intersectingCoordinateFrom(startPoint, new util.Route(start, end, start.levelcode));
  //     resNodes.push(startPoint);
  //     resNodes.push(intersect);
  //     resNodes.push(end);
  //     continue;
  //   }
  //   if (i == nodesCoordinate.length - 2) {
  //     var start = nodesCoordinate[i];
  //     var end = nodesCoordinate[i + 1];
  //     var intersect = routesManger.intersectingCoordinateFrom(endPoint, new util.Route(start, end, start.levelcode));
  //     resNodes.push(start);
  //     resNodes.push(intersect);
  //     resNodes.push(endPoint);
  //     break;
  //   }
  //   resNodes.push(nodesCoordinate[i]);
  // }
  return resNodes;
}

function Nodes2Routes(nodes) {
  var routes = [];
  for (var i = 0 ;i < nodes.length -1;i++) {
    var route = new util.Route(nodes[i], nodes[i + 1], nodes[i].levelcode);
    routes.push(route);
    }
  return routes;
}

function GetPoiByMarkerID(pois,markerID){
  for (var i in pois){
    if (pois[i].markerID == markerID){
      return pois[i];
    }
  }
  return null;
}



