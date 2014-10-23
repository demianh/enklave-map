var BOT = {
  interval: {},
  speed: 5000,
  socket: null,
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
    this.sendLocation();
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
    console.log('craft item ');
    var data = {
      'session_id': session_id,
      'item_crafted': 'brick',
      'lon': this.location.lon,
      'lat': this.location.lat
    };
    this.socket.emit('client_data', JSON.stringify(data));
  },
  buildUpgrade: function(enklave_id){
    console.log('build upgrade: '+enklave_id);
    var data = {
      'session_id': session_id,
      'build_upgrade': enklave_id,
      'lon': this.location.lon,
      'lat': this.location.lat
    };
    this.socket.emit('client_data', JSON.stringify(data));
  },
  sendLocation: function() {
    var data = {
      'session_id': session_id,
      'lon': this.location.lon,
      'lat': this.location.lat
    };
    this.socket.emit('client_data', JSON.stringify(data));
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