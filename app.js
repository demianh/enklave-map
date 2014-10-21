
var HOST = 'http://54.77.170.34';
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

var socket = io.connect(HOST+':'+SOCKET_PORT);

function start(){

    // Client Data
    socket.on('client', function(data){
        if (session_id == '' && data.session_id){
            session_id = data.session_id;
            localStorage.setItem("username", username);
            localStorage.setItem("password", password);
            $('#login').modal('hide');
            $('#sidebar').show();
            google.maps.event.trigger(map, 'resize');
        }
        if (data.messages){
            console.log(data.messages[0]);
            var regex = /^You have found ([0-9])+/g;
            var match = regex.exec(data.messages[0]);
            if (match){
                // scrap found
                var scrap = parseInt(match[1]);
                addScrapMarker('img/blue-dot.png');
                scrap_found += scrap;
            } else {
                // no scrap
                addScrapMarker('img/red-dot.png');
            }
            craftItem();
            logging(data.messages[0]);
            propertiesUpdated();
        }
        if (data.error){
            console.log(data.error);
            logging('<span class="text-danger">'+data.error+'</span>');
        }
        if (data.events){
            for (var ev in data.events) {
                properties[data.events[ev].type] = data.events[ev].data;
                propertiesUpdated();
            }
        }
        console.log(data);
        
    });

    // Global Events
    socket.on('global', function(data){
        console.log('___GLOBAL___',data);
        if (data.events){
            for (var ev in data.events) {
                properties[data.events[ev].type] = data.events[ev].data;
                propertiesUpdated();
                if (data.events[ev].type == 6){
                    enklavesUpdated();
                }
            }
        }
    })

    // autologin
    if (username != ''){
        $('#login').hide();
        login();
    } else {
        $('#login').modal('show');
    }
}

function login(){
    var data = {
        'username': username, 
        'password': password, 
        'device': ['GT-I9300', 'Android', '4.4.4', 360, 'c1acca20009bf2ee']
    };
    socket.emit('client_data', JSON.stringify(data));
    logging('Login to Enklave...');
}

function logout(){
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

function logging(message){
    log.unshift(message);
    propertiesUpdated();
}

function run(){
    interval = setInterval(function () {
        sendLocation();
    }, 5000);
    $('#btn_run').toggle();
    $('#btn_pause').toggle();
}

function pause(){
    window.clearInterval(interval)
    $('#btn_run').toggle();
    $('#btn_pause').toggle();
}

function sendLocation(){
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

function craftItem(){
    console.log('craft item ');
    var data = {
        'session_id': session_id, 
        'item_crafted': 'brick', 
        'lon': current_lon, 
        'lat': current_lat
    };
    socket.emit('client_data', JSON.stringify(data));
}

function move(){
    current_lat = current_lat + speed_lat;
    current_lon = current_lon + speed_lon;
    localStorage.setItem("lat", current_lat);
    localStorage.setItem("lon", current_lon);
    updateMarker();
}

function propertiesUpdated(){
    localStorage.setItem("properties", JSON.stringify(properties));
    $('#scrap').html(scrap_found);
    if (properties[1]){
        $('#inventory').html('Scrap: '+properties[1][0]+'<br>Bricks: '+properties[1][1]+'<br>Cells: '+properties[1][2]);
    }
    if (properties[3]){
        $('#profile').html(
            '<h5 style="color: #'+properties[3].color+'">'+properties[3].username+' L'+properties[3].level+'</h5>' +
            '<div>Faction: '+properties[3].faction_name+'</div>' +
            '<div>XP: '+properties[3].xp+'/'+properties[3].next_level_xp+'</div>' +
            '<div>Energy: '+properties[3].energy+'/'+properties[3].max_energy+'</div>'
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

function initialize() {
    var mapOptions = {
        zoom: 15,
        center: new google.maps.LatLng(current_lat, current_lon)
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);

    updateMarker();
    enklavesUpdated();
    setGeoLocationMarker();
}

google.maps.event.addDomListener(window, 'load', initialize);

function setGeoLocationMarker(){
  if(navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
      var myloc = new google.maps.Marker({
        clickable: false,
        position: pos,
        icon: new google.maps.MarkerImage(
            '//maps.gstatic.com/mapfiles/mobile/mobileimgs2.png',
            new google.maps.Size(22,22),
            new google.maps.Point(0,18),
            new google.maps.Point(11,11)
        ),
        shadow: null,
        zIndex: 999,
        map: map
      });
      map.setCenter(pos);
    }, function() {
      logging('Unable to get your location');
    });
  } else {
    // Browser doesn't support Geolocation
    logging('Geolocation not available');
  }
}

function updateMarker() {
  if(marker){
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

function enklavesUpdated(){
    var enkl = properties[2];
    if(enkl){
        for (var i in enkl) {
            var enklave = new google.maps.Marker({
                position: new google.maps.LatLng(enkl[i].latitude, enkl[i].longitude),
                map: map,
                icon: {
                    url: HOST + '/img/enklave-faction-' + (enkl[i].faction_id ? enkl[i].faction_id : '0') + '.png',
                    scaledSize: new google.maps.Size(32, 32),
                    origin: new google.maps.Point(0,0),
                    anchor: new google.maps.Point(16, 16)
                }
            });
        }
    }
    google.maps.event.trigger(map, 'resize');
}
