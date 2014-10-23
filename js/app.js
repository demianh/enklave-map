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
    if (session_id == '' && data.session_id) {
      session_id = data.session_id;
      localStorage.setItem("username", username);
      localStorage.setItem("password", password);
      $('#login').modal('hide');
      $('#sidebar').show();
      google.maps.event.trigger(map, 'resize');
      logging('Login successful');
      BOT.movetome();
    }
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
    if (data.error) {
      console.log(data.error);
      logging('<span class="text-danger">' + data.error + '</span>');
    }
    if (data.events) {
      for (var ev in data.events) {
        var event = data.events[ev];
        properties[event.type] = event.data;
        console.log(event);
        switch (event.type) {
          case 1: // inventory update
            break;
          case 3: // profile update
            break;
          default:
            properties[event.type] = event.data;
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
          case 1: // inventory
            updateInventory(event.data);
            break;
          case 2: // enklaves
            updateEnklaves(event.data);
            break;
          case 3: // profile
            updateCharacter(event.data);
            break;
          case 4: // single enklave
            updateEnklave(event.data);
            break;
          case 5: // fight start
            break;
          case 6: // enklave list
            properties[event.type] = event.data;
            enklavesUpdated();
            break;
          case 7: // fight ended
            break;
          default:
            console.log('Unknown event type');
        }
        propertiesUpdated();
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

function logging(message) {
  log.unshift(message);
  propertiesUpdated();
}

function updateEnklave(data){
  for (var j in properties[2]) {
    if (properties[2][j].id == data.id){
      properties[2][j].bricks =  data.bricks;
      properties[2][j].bricks_upgrade = data.bricks_upgrade;
      properties[2][j].faction_id = data.faction_id;
      properties[2][j].level = data.level;
      properties[2][j].scrap_capacity = data.scrap_capacity;
      properties[2][j].scrap_production = data.scrap_production;
      enklavesUpdated();
    }
  }
}

function updateCharacter(data){
  console.log('___PROFILE UPDATE___',data);
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
    // remove old markers
    /*
    for (var i in enklaveMarkers) {
      enklaveMarkers[i].setMap(null);
    }
    */
    // add new markers
    for (var i in enklaves) {
      var enklave = enklaves[i];
      var enklaveMarker = new google.maps.Marker({
        position: new google.maps.LatLng(enklave.latitude, enklave.longitude),
        map: map,
        icon: {
          url: 'img/enklave-faction-' + (enklave.faction_id ? enklave.faction_id : '0') + '.png',
          scaledSize: new google.maps.Size(32, 32),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(16, 16)
        },
        enklave_id: enklave.id
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
        infowindow.setContent(getEnklaveMarkup(this.enklave_id));
        infowindow.open(map, this);
      });
      enklaveMarkers[enklave.id] = enklaveMarker;
    }
  }
  google.maps.event.trigger(map, 'resize');
}
