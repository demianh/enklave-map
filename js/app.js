var HOST = 'http://enklave-mobile.com';
var SOCKET_PORT = '1337';

var username = (localStorage.getItem("username") ? localStorage.getItem("username") : '');
var password = (localStorage.getItem("password") ? localStorage.getItem("password") : '');

var properties = (localStorage.getItem("properties") ? JSON.parse(localStorage.getItem("properties")) : []);

var defaultLocation = {
  lat: 47.37811,
  lon: 8.53993
};
var myLocation = (localStorage.getItem("myLocation") ? JSON.parse(localStorage.getItem("myLocation")) : defaultLocation);

var session_id = '';
var device_id = (localStorage.getItem("device_id") ? localStorage.getItem("device_id") : generateDeviceId());

var scrap_found = 0;
var log = [];

var factionNames = ["Neutral", "Prometheans", "Architechs", "Edenites"];
var factionColors = ["#888", "#ff0000", "#00ffff", "#00ff00"];

var socket;

function start() {

  socket = io.connect(HOST + ':' + SOCKET_PORT);
  BOT.socket = socket;

  // Client Data
  socket.on('client', function (data) {
    console.log('___CLIENT___', data);

    // Client Login
    if (session_id == '' && data.session_id) {
      session_id = data.session_id;
      localStorage.setItem("username", username);
      localStorage.setItem("password", password);
      $('#login').modal('hide');
      $('#sidebar').show();
      // Hide sidebar on Mobile
      if ($(window).width() < 700){
        toggleSidebar();
      }
      google.maps.event.trigger(map, 'resize');
      logging('Login successful');
      BOT.movetome();
    }

    // Client Messages
    if (data.messages) {
      for (var i in data.messages) {
        var msg = data.messages[i];
        //console.log(msg);
        var regex = /^You have found ([0-9]+)/g;
        var match = regex.exec(msg);
        //console.log(match);
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
          BOT.craftItem();
        }
        logging(msg);

      }
      propertiesUpdated();
    }

    // Client Errors
    if (data.error) {
      console.log(data.error);
      logging('<span class="text-danger">' + data.error + '</span>');
    }

    // Client Events
    if (data.events) {
      for (var ev in data.events) {
        var event = data.events[ev];
        console.log(event);
        switch (event.type) {
          case 1: // inventory update
            properties[event.type] = mergeProperties(properties[event.type], event.data);
            break;
          case 2: // enklaves list
            properties[event.type] = mergeProperties(properties[event.type], event.data);
            enklavesUpdated();
            break;
          case 3: // profile update
            properties[event.type] = mergeProperties(properties[event.type], event.data);
            break;
          default:
            properties[event.type] = mergeProperties(properties[event.type], event.data);
            console.log('Unknown event type');
        }
        propertiesUpdated();
      }
    }
    console.log(data);

  });

  // Global Events
  socket.on('global', function (data) {
    console.log('___GLOBAL___', data);
    if (data.events) {
      for (var i in data.events) {
        var event = data.events[i];
        console.log(event);
        switch (event.type) {
          case 4: // single enklave
            updateEnklave(event.data);
            propertiesUpdated();
            break;
          case 6: // fight data
            properties[event.type] = mergeProperties(properties[event.type], event.data);
            break;
          case 7: // fight ended
            properties[event.type] = mergeProperties(properties[event.type], event.data);
            break;
          default:
            console.log('Unknown event type');
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
    'device': ['GT-I9300', 'Android', '4.4.4', 360, device_id]
  };
  socket.emit('client_data', JSON.stringify(data));
  logging('Login to Enklave...');
}

function logout() {
  username = '';
  password = '';
  properties = [];
  myLocation = defaultLocation;
  localStorage.setItem("username", username);
  localStorage.setItem("password", password);
  localStorage.setItem("properties", JSON.stringify(properties));
  localStorage.setItem("myLocation", JSON.stringify(myLocation));
  location.reload();
}

function saveCredentials() {
  username = $('#username').val();
  password = $('#password').val();
  login();
  return false;
}

function generateDeviceId() {
  var length = 16;
  var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  var result = '';
  for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
  localStorage.setItem("device_id", result);
  return result;
}

function logging(message) {
  log.unshift(message);
  propertiesUpdated();
}

function updateEnklave(data){
  for (var j in properties[2]) {
    if (properties[2][j].id == data.id){
      if (properties[2][j].faction_id != data.faction_id){
        console.log('ENKLAVE FACTION CHANGED', properties[2][j].faction_id, data.faction_id);
      }
      properties[2][j] = mergeProperties(properties[2][j], data);
      enklavesUpdated();
    }
  }
}

function getEnklave(id){
  var enklaves = properties[2];
  if (enklaves) {
    for (var i in enklaves) {
      if(enklaves[i].id == id){
        return enklaves[i];
      }
    }
  }
}

function mergeProperties(obj1, obj2){
  if (typeof obj1 == 'undefined'){
    return obj2;
  }
  if (typeof obj2 !== 'undefined'){
    for (var key in obj2){
      if (obj2.hasOwnProperty(key)) {
        obj1[key] = obj2[key];
      }
    }
  }
  return obj1;
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

function toggleSidebar(){
  $('#sidebar').toggle();
  $('#sidebar-closed').toggle();
}

/* api

 build_upgrade: enklave_id

 */


// ---- MAP ----

var map;
var marker;
var enklaveMarkers = [];
var infowindow = null;

function initializeMap() {
  var mapOptions = {
    zoom: 15,
    center: new google.maps.LatLng(myLocation.lat, myLocation.lon),
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

  enklavesUpdated();
  setGeoLocationMarker();
}

google.maps.event.addDomListener(window, 'load', initializeMap);

function setGeoLocationMarker() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (position) {
      myLocation.lat = position.coords.latitude;
      myLocation.lon = position.coords.longitude;
      localStorage.setItem("myLocation", JSON.stringify(myLocation));
      var pos = new google.maps.LatLng(myLocation.lat, myLocation.lon);
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
      map.setCenter(pos);
      BOT.movetome();
    }, function () {
      logging('Unable to get your location');
    });
  } else {
    // Browser doesn't support Geolocation
    logging('Geolocation not available');
  }
}

function updateBotMarker() {
  if (marker) {
    marker.setMap(null);
  }
  marker = new google.maps.Marker({
    position: new google.maps.LatLng(BOT.location.lat, BOT.location.lon),
    map: map
  });
  map.setCenter(marker.getPosition());
  google.maps.event.trigger(map, 'resize');
}

function addScrapMarker(img) {
  new google.maps.Marker({
    position: new google.maps.LatLng(BOT.location.lat, BOT.location.lon),
    map: map,
    icon: img
  });
}

function getEnklaveMarkup(id){
  var enklave = getEnklave(id);
  var faction_id = (enklave.faction_id ? enklave.faction_id : 0);
  return '<div class="enklavePopup">' +
    '<h3>' + enklave.name + '</h3>' +
    '<h4 style="color: ' + factionColors[faction_id] + '">' + factionNames[faction_id] + '</h4>' +
    '<div><img class="img-thumbnail" src="' + enklave.img_src + '"></div>' +
    '<br>' +
    '<div><b>Level:</b> ' + enklave.level + '</div>' +
    '<div><b>Bricks:</b> ' + enklave.bricks + '/' + enklave.bricks_upgrade + '</div>' +
    '<div><b>Production:</b> ' + enklave.scrap_production + '/h</div>' +
    '<div><b>Storage:</b> ' + enklave.scrap + '/' + enklave.scrap_production + '</div>' +
    '<div><b>ID:</b> ' + enklave.id + '</div>' +
    '<div>' +
    '<button type="button" class="btn btn-primary" onclick="BOT.moveto('+enklave.latitude+','+enklave.longitude+')"><span class="glyphicon glyphicon-map-marker"></span>&nbsp;&nbsp;Jump Here</button> ' +
    '<button type="button" class="btn btn-primary" onclick="BOT.buildUpgrade('+enklave.id+')"><span class="glyphicon glyphicon-home"></span>&nbsp;&nbsp;Build</button>' +
    '</div>' +
    '</div>';
}

function enklavesUpdated() {
  var enklaves = properties[2];
  if (enklaves) {
    // add new markers
    for (var i in enklaves) {
      var enklave = enklaves[i];
      // add if new or faction changed
      if(typeof enklaveMarkers[enklave.id] == 'undefined' || enklaveMarkers[enklave.id].faction_id != enklave.faction_id){
        if (typeof enklaveMarkers[enklave.id] != 'undefined'){
          enklaveMarkers[enklave.id].setMap(null);
        }
        var enklaveMarker = new google.maps.Marker({
          position: new google.maps.LatLng(enklave.latitude, enklave.longitude),
          map: map,
          icon: {
            url: 'img/enklave-faction-' + (enklave.faction_id ? enklave.faction_id : '0') + '.png',
            scaledSize: new google.maps.Size(32, 32),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(16, 16)
          },
          enklave_id: enklave.id,
          faction_id: enklave.faction_id
        });

        google.maps.event.addListener(enklaveMarker, 'click', function () {
          infowindow.setContent(getEnklaveMarkup(this.enklave_id));
          infowindow.open(map, this);
        });
        enklaveMarkers[enklave.id] = enklaveMarker;
      }
    }
  }
  // update open infowindow
  if (infowindow.anchor){
    infowindow.setContent(getEnklaveMarkup(infowindow.anchor.enklave_id));
  }
  google.maps.event.trigger(map, 'resize');
}
