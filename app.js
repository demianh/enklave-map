var HOST = 'http://enklave-mobile.com';
var SOCKET_PORT = '1337';

var current_lat = (localStorage.getItem("lat") ? parseFloat(localStorage.getItem("lat")) : 47.37811);
var current_lon = (localStorage.getItem("lon") ? parseFloat(localStorage.getItem("lon")) : 8.53993);

var username = (localStorage.getItem("username") ? localStorage.getItem("username") : '');
var password = (localStorage.getItem("password") ? localStorage.getItem("password") : '');

var properties = (localStorage.getItem("properties") ? JSON.parse(localStorage.getItem("properties")) : []);

var session_id = '';

var speed_lat = 0.0001;
var speed_lon = 0.00003;

var interval;
var iterations = 0;
var scrap_found = 0;
var log = [];

var factionNames = ["Neutral", "Prometheans", "Architechs", "Edenites"];
var factionColors = ["#888", "#ff0000", "#00ffff", "#00ff00"];

var infowindow = null;

var socket = io.connect(HOST + ':' + SOCKET_PORT);

function start() {

  // Client Data
  socket.on('client', function (data) {
    if (session_id == '' && data.session_id) {
      session_id = data.session_id;
      localStorage.setItem("username", username);
      localStorage.setItem("password", password);
      $('#login').modal('hide');
      $('#sidebar').show();
      google.maps.event.trigger(map, 'resize');
    }
    if (data.messages) {
      console.log(data.messages[0]);
      var regex = /^You have found ([0-9])+/g;
      var match = regex.exec(data.messages[0]);
      if (match) {
        // scrap found
        var scrap = parseInt(match[1]);
        addScrapMarker('img/dot-green.png');
        scrap_found += scrap;
      } else {
        // no scrap
        addScrapMarker('img/dot-red.png');
      }
      if (properties[1][0] > 20){
        craftItem();
      }
      logging(data.messages[0]);
      propertiesUpdated();
    }
    if (data.error) {
      console.log(data.error);
      logging('<span class="text-danger">' + data.error + '</span>');
    }
    if (data.events) {
      for (var ev in data.events) {
        properties[data.events[ev].type] = data.events[ev].data;
        propertiesUpdated();
      }
    }
    console.log(data);

  });

  // Global Events
  socket.on('global', function (data) {
    console.log('___GLOBAL___', data);
    if (data.events) {
      for (var ev in data.events) {
        properties[data.events[ev].type] = data.events[ev].data;
        propertiesUpdated();
        if (data.events[ev].type == 6) {
          enklavesUpdated();
        }
      }
    }
  })

  // autologin
  if (username != '') {
    $('#login').hide();
    login();
  } else {
    $('#login').modal('show');
  }
}

function login() {
  var data = {
    'username': username,
    'password': password,
    'device': ['GT-I9300', 'Android', '4.4.4', 360, 'c1acca20009bf2ee']
  };
  socket.emit('client_data', JSON.stringify(data));
  logging('Login to Enklave...');
}

function logout() {
  username = '';
  password = '';
  properties = [];
  localStorage.setItem("username", username);
  localStorage.setItem("password", password);
  localStorage.setItem("properties", JSON.stringify(properties));
  location.reload();
}

function saveCredentials() {
  username = $('#username').val();
  password = $('#password').val();
  login();
  return false;
}

function logging(message) {
  log.unshift(message);
  propertiesUpdated();
}

function run() {
  interval = setInterval(function () {
    sendLocation();
  }, 5000);
  $('#btn_run').toggle();
  $('#btn_pause').toggle();
}

function pause() {
  window.clearInterval(interval)
  $('#btn_run').toggle();
  $('#btn_pause').toggle();
}

function sendLocation() {
  move();
  iterations++;
  console.log('moving to ' + current_lat + ', ' + current_lon);
  var data = {
    'session_id': session_id,
    'lon': current_lon,
    'lat': current_lat
  };
  socket.emit('client_data', JSON.stringify(data));
}

function craftItem() {
  console.log('craft item ');
  var data = {
    'session_id': session_id,
    'item_crafted': 'brick',
    'lon': current_lon,
    'lat': current_lat
  };
  socket.emit('client_data', JSON.stringify(data));
}

function move() {
  current_lat = current_lat + speed_lat;
  current_lon = current_lon + speed_lon;
  localStorage.setItem("lat", current_lat);
  localStorage.setItem("lon", current_lon);
  updateMarker();
}

function propertiesUpdated() {
  localStorage.setItem("properties", JSON.stringify(properties));
  $('#scrap').html(scrap_found);
  if (properties[1]) {
    $('#inventory').html('Scrap: ' + properties[1][0] + '<br>Bricks: ' + properties[1][1] + '<br>Cells: ' + properties[1][2]);
  }
  if (properties[3]) {
    $('#profile').html(
        '<h4>' + properties[3].username + ' L' + properties[3].level + '</h4>' +
        '<div>Faction: <span style="color: #' + properties[3].color + '">' + properties[3].faction_name + '</span></div>' +
        '<div>XP: ' + properties[3].xp + '/' + properties[3].next_level_xp + '</div>' +
        '<div>Energy: ' + properties[3].energy + '/' + properties[3].max_energy + '</div>'
    );
  }
  $('#log').html(log.join('<br>'));
}

/* api

 build_upgrade: enklave_id

 */


// ---- MAP ----

var map;
var marker;
var enklave_markers = [];

function initializeMap() {
  var mapOptions = {
    zoom: 15,
    center: new google.maps.LatLng(current_lat, current_lon),
    styles: [{
      "featureType": "all",
      "elementType": "all",
      "stylers": [{"invert_lightness": true}, {"saturation": 10}, {"lightness": 30}, {"gamma": 0.5}, {"hue": "#435158"}]
    }]
  };
  map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

  infowindow = new google.maps.InfoWindow({
    content: "Loading..."
  });

  updateMarker();
  enklavesUpdated();
  setGeoLocationMarker();
}

google.maps.event.addDomListener(window, 'load', initializeMap);

function setGeoLocationMarker() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      var myloc = new google.maps.Marker({
        clickable: false,
        position: pos,
        icon: new google.maps.MarkerImage(
            '//maps.gstatic.com/mapfiles/mobile/mobileimgs2.png',
            new google.maps.Size(22, 22),
            new google.maps.Point(0, 18),
            new google.maps.Point(11, 11)
        ),
        shadow: null,
        zIndex: 999,
        map: map
      });
      //map.setCenter(pos);
    }, function () {
      logging('Unable to get your location');
    });
  } else {
    // Browser doesn't support Geolocation
    logging('Geolocation not available');
  }
}

function updateMarker() {
  if (marker) {
    marker.setMap(null);
  }
  marker = new google.maps.Marker({
    position: new google.maps.LatLng(current_lat, current_lon),
    map: map
  });
  map.setCenter(marker.getPosition());
  google.maps.event.trigger(map, 'resize');
}

function addScrapMarker(img) {
  var scrap = new google.maps.Marker({
    position: new google.maps.LatLng(current_lat, current_lon),
    map: map,
    icon: img
  });
}

function enklavesUpdated() {
  var enklaves = properties[2];
  if (enklaves) {
    for (var i in enklaves) {
      var enklave = enklaves[i];
      var faction_id = (enklave.faction_id ? enklave.faction_id : 0);
      var enklaveMarker = new google.maps.Marker({
        position: new google.maps.LatLng(enklave.latitude, enklave.longitude),
        map: map,
        icon: {
          url: 'img/enklave-faction-' + (enklave.faction_id ? enklave.faction_id : '0') + '.png',
          scaledSize: new google.maps.Size(32, 32),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(16, 16)
        },
        html: '<div class="enklavePopup">' +
        '<h3>' + enklave.name + '</h3>' +
        '<h4 style="color: ' + factionColors[faction_id] + '">' + factionNames[faction_id] + '</h4>' +
        '<div><img class="img-thumbnail" src="' + enklave.img_src + '"></div>' +
        '<br>' +
        '<div><b>Level:</b> ' + enklave.level + '</div>' +
        '<div><b>Bricks:</b> ' + enklave.bricks + '/' + enklave.bricks_upgrade + '</div>' +
        '<div><b>Production:</b> ' + enklave.scrap_production + '/h</div>' +
        '<div><b>Storage:</b> ' + enklave.scrap + '/' + enklave.scrap_production + '</div>' +
        '<div><b>Storage:</b> ' + enklave.scrap + '/' + enklave.scrap_production + '</div>' +
        '</div>'
      })

      /*
       bricks: 2
       bricks_upgrade: 9
       faction_id: "1"
       id: "675"
       image_id: "934"
       img_src: "http://enklave-mobile.com/upload/location-image/934.JPG"
       latitude: "47.3780275"
       level: 0
       longitude: "8.5397237"
       name: "Zurich Mainstation"
       original_filename: "ZurichMainstation.JPG"
       scrap: 400
       scrap_capacity: 400
       scrap_production: 25
      */

      google.maps.event.addListener(enklaveMarker, 'click', function () {
        infowindow.setContent(this.html);
        infowindow.open(map, this);
      });
    }


  }
  google.maps.event.trigger(map, 'resize');
}
