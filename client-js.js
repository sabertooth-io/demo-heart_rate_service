const BluetoothDevice = require('web-bluetooth');

/*
* We set up our bluetooth device variable that'll be used to initialize a bluetooth device object.
*/
var blue;

/**
* The below callback function handles connecting to a device when a user clicks on a the connect button.
* We initiate the device with the user provided name or namePrefix required to request and connect to
* a Bluetooth Low Energy device.
*
* After the device is initialized by calling the 'new Device' method, we call the '.connect()' method.
* The connect method requests the device and connects to it.
*/
$('#connect').on('touchstart click', (event) => {
  var services = $('#serviceFilter').val();
  var name = $('#nameFilter').val();
  var prefix = 'P';
  var filterObj = {}
  if (services) filterObj['services'] = services;
  if (name) filterObj['name'] = name;
  if (prefix) filterObj['namePrefix'] = prefix;

  blue = new BluetoothDevice(filterObj);

  blue.connect().then(device => {
    $('#load').hide();
    $('#connect').hide();

    var canvas = document.getElementById('updating-chart'),
      ctx = canvas.getContext('2d'),
      startingData = {
        labels: [1, 2, 3, 4, 5, 6, 7],
        datasets: [{
          fillColor: "rgba(254, 254, 254, 0.5)",
          strokeColor: "rgba(254, 254, 254, 100)",
          pointColor: "rgba(254, 254, 254, 100)",
          pointStrokeColor: "#fff",
          data: [55]
        }]
      },
      latestLabel = startingData.labels[6];
    var options = {
      legend: {
        display: true,
        labels: {
          fontColor: "rgba(255,255,255,100)"
        }
      },
      scaleFontColor: "#ff0000"
    }

    var myLiveChart = new Chart(ctx).Line(startingData, {
      animationSteps: 15
    }, options);

    /**
    * The below function handles starting a stream of data notifications from a device with the 'notify' property.
    * In this demo example, we pass in 'heart_rate_measurement', one of the adopted services to the 'startNotifications()' method.
    * The startNotifications() method will do the heavy lifting to read the value from the device, parse the array buffer that's
    * returned from the device and send back a value stored on an object. The object returned by the startNotifications()
    * method stores two things: 1. parsed value and 2. the original value (allows developers to parse as they need to).
    */
    blue.startNotifications('heart_rate_measurement', e => {
        (function pulse(back) {
          $('#heart').animate({
            opacity: (back) ? 1 : 0.2
          }, 950, function() {
            pulse(!back)
          });
        })(false);
        $('#heart_rate').show();
        $('#bpm-value').text(e.heartRate + ' ');
        myLiveChart.addData([e.heartRate], ++latestLabel);
      })
      .catch(error => {
        console.log(error);
      })
  });
  $('#load').show();
});

/**
* The below callback function handles disconnecting from the device by calling the 'disconnect()' method.
* disconnect() returns a Boolean indicating whether disconnecting was successful or not.
*/
$('#disconnect').on('touchstart click', (event) => {
  if (blue.disconnect()) {
    $('#status').text('Disconnected!');
    $('#connect').show();
    $('#disconnect').hide();
    $('#getvalue').hide();
    $('#startNotify').hide();
    $('#stopNotify').hide();
  } else {
    $('#status').text('Disconnect failed!');
  }
});

/**
* The below callback function handles cancelling the request from the device by calling the 'disconnect()' method.
* disconnect() returns a Boolean indicating whether disconnecting was successful or not.
* A user can also cancel connecting via the browser provided controls.
*/
$('#cancel').on('click', event => {
  event.preventDefault();
  $('#load').hide();
  $('#connect').show();
  $('#disconnect').hide();
  if (blue.disconnect()) $('#status').text('Not connected');
});
