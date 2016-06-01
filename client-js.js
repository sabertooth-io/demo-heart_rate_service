// const Device = require('bluetooth.js');

var percentage = 30;
// removed value assignment from blue at variable declaration
var blue;

// $(window).load(function() {
//
// });

//battery_service
$('#connect').on('touchstart click', (event) => {
  var services = $('#serviceFilter').val();
  var name = $('#nameFilter').val();
  var prefix = 'P';
  var filterObj = {}
  // moved here to populate from filters rather than on page load
  // filterObj['services'] = ['battery_service'];
  //filterObj['optional_services'] = ['battery_service','carlos_custom_service'];
  if (services) filterObj['services'] = services;
  if (name) filterObj['name'] = name;
  if (prefix) filterObj['namePrefix'] = prefix;

  blue = new BluetoothDevice(filterObj);
  console.log(blue);
  blue.connect().then(device => {
    $('#load').hide();
    $('#connect').hide();
    // $('#getvalue').show();
    // $('#startNotify').show();
    // $('#stopNotify').show();
    // $('#disconnect').show();
    // $('#status').text('Connected!');
    (function pulse(back) {
      $('#heart').animate(
          {
              // 'font-size': (back) ? '100px' : '110px',
              opacity: (back) ? 1 : 0.5
          }, 500, function(){pulse(!back)});
    })(false);

  var canvas = document.getElementById('updating-chart'),
      ctx = canvas.getContext('2d'),
      startingData = {
        labels: [1, 2, 3, 4, 5, 6, 7],
        datasets: [
            {
                fillColor: "rgba(34, 62, 85, 1)",
                strokeColor: "rgba(34, 62, 85, 1)",
                pointColor: "rgba(34, 62, 85, 1)",
                pointStrokeColor: "rgba(34, 62, 85, 1)",
                data: [40,60]
            },
            {   label: "My Second dataset",
                fillColor: "rgba(34, 62, 85, 1)",
                strokeColor: "rgba(151,187,205,1)",
                pointColor: "rgba(151,187,205,1)",
                pointStrokeColor: "#fff",
                data: [90.90]
            }
        ]
      },
      latestLabel = startingData.labels[6];
  var options = {
          legend: {
            display: true,
            labels: {
              fontColor: "rgba(151,187,205,1)"
            }
          },
          scaleFontColor: "#ff0000"
        }

  var myLiveChart = new Chart(ctx).Line(startingData, {animationSteps: 15}, options);

  blue.startNotifications('heart_rate_measurement', e => {
      console.log('start notify callback',e.heart_rate_measurement);
      myLiveChart.addData(e.heart_rate_measurement, ++latestLabel);
    })
    .catch(error => {
      console.log(error);
    })
    });
    $('#load').show();
});

$('#disconnect').on('touchstart click', (event) => {
    if (blue.disconnect()) {
      $('#status').text('Disconnected!');
      $('#connect').show();
      $('#disconnect').hide();
      $('#getvalue').hide();
      $('#startNotify').hide();
      $('#stopNotify').hide();
    }
    else {
      $('#status').text('Disconnect failed!');
    }
});

$('#getvalue').on('touchstart click', (event) => {
  var characteristic = $('#characteristic').val();
  console.log(characteristic);
  blue.getValue(characteristic)
  .then(value => {
    $('#level').text(`${value}%`);
    //percentage = value;
    batteryFill(value);
  })
  .catch(error => {
    console.log(error);
  })
});

$('#startNotify').on('touchstart click', (event) => {
  var characteristic = $('#characteristic').val();
  blue.startNotifications(characteristic, e => {
    console.log('start notify callback');
    var newHR = parseHeartRate(e.target.value);
    $('#level').append(`<p>${newHR.heartRate}</p>`);
  })
  // .then(value => {
  //   console.log('in returned promise...')

    // value.addEventListener('characteristicvaluechanged', event =>{
    //   var newHR = parseHeartRate(event.target.value);
    //   console.log('newHR: ', newHR);
    //   $('#level').append(`<p>${newHR.heartRate}</p>`);
    // });
  // })
  .catch(error => {
    console.log(error);
  })
});

$('#stopNotify').on('touchstart click', (event) => {
  var characteristic = $('#characteristic').val();
  blue.stopNotifications(characteristic).then(() => {
    console.log('in client-js2, stopped notifications');
  });
});

//TODO: handling for disconnect
$('#cancel').on('click', event => {
  event.preventDefault();
  $('#load').hide();
  $('#connect').show();
  $('#disconnect').hide();
  if (blue.disconnect()) $('#status').text('Not connected');
});

// $('#disconnect');


function batteryFill(percentage) {
  $('#battery-fill').velocity({
    height: `${percentage}%`
  },{
    duration:1000,
    easing:'linear'
  });
  // $('#battery-fill').addClass('battery-transition');
}


// Francios parser... need to add to gattCharacteristicsMapping object
function parseHeartRate(value) {
  // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
  //console.log('value: ', value);
  //console.log(value);
  //console.log('valueStr: ', JSON.stringify(value))
  value = value.buffer ? value : new DataView(value);
  console.log('Value from DataView: ',value);
  let flags = value.getUint8(0);
  //console.log('flags: ', flags);
  let rate16Bits = flags & 0x1;
  //console.log('rate16Bits: ', rate16Bits);
  let result = {};
  let index = 1;
  if (rate16Bits) {
    result.heartRate = value.getUint16(index, /*littleEndian=*/true);
    index += 2;
  } else {
    result.heartRate = value.getUint8(index);
    index += 1;
  }
  let contactDetected = flags & 0x2;
  //console.log('contactDetected: ', contactDetected);
  let contactSensorPresent = flags & 0x4;
  //console.log('contactSensorPresent: ', contactSensorPresent);
  if (contactSensorPresent) {
    result.contactDetected = !!contactDetected;
  }
  let energyPresent = flags & 0x8;
  //console.log('energyPresent: ', energyPresent);
  if (energyPresent) {
    result.energyExpended = value.getUint16(index, /*littleEndian=*/true);
    index += 2;
  }
  let rrIntervalPresent = flags & 0x10;
  //console.log('rrIntervalPresent: ', rrIntervalPresent);
  if (rrIntervalPresent) {
    let rrIntervals = [];
    for (; index + 1 < value.byteLength; index += 2) {
      rrIntervals.push(value.getUint16(index, /*littleEndian=*/true));
    }
    result.rrIntervals = rrIntervals;
  }
  console.log('parsed result: ',result);
  return result;
}
