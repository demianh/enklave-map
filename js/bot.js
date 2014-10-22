var BOT = {
  interval: {},
  speed: 5000,
  location: {
    lat: (localStorage.getItem("lat") ? parseFloat(localStorage.getItem("lat")) : 47.37811),
    lon: (localStorage.getItem("lon") ? parseFloat(localStorage.getItem("lon")) : 8.53993)
  },
  direction: {
    lat: 0.0001,
    lon: 0
  },
  setSpeed: function (val) {
    this.speed = val * 100;
    this.pause();
    this.run();
    $('#speed_value').html((val*100)+'ms');
  },
  setDirection: function (val) {
    this.direction.lat = Math.cos(val * Math.PI/180)/10000;
    this.direction.lon = Math.sin(val * Math.PI/180)/10000;
    $('#direction_value').html(val+'°');
  },
  moveto: function(lat, lon){
    this.location.lat = lat;
    this.location.lon = lon;
    localStorage.setItem("lat", lat);
    localStorage.setItem("lon", lon);
    sendLocation();
    updateBotMarker();
  },
  movetome: function() {
    this.moveto(
        myLocation.lat,
        myLocation.lon
    )
  },
  move: function() {
    this.moveto(
        this.location.lat + this.direction.lat,
        this.location.lon + this.direction.lon
    )
  },
  craftItem: function(){

  },
  run: function(){
    this.interval = setInterval(function () {
      BOT.move();
    }, this.speed);
    $('#btn_run').toggle();
    $('#btn_pause').toggle();
  },
  pause: function(){
    window.clearInterval(this.interval);
    $('#btn_run').toggle();
    $('#btn_pause').toggle();
  }
};