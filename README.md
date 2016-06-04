![web-bluetooth image](/assets/HRS.png)

### Web-Bluetooth Demo: Heart Rate Service

This simple demo uses the Web-Bluetooth library to connect to a device broadcasting a Heart Rate Service characteristic and reads the heart rate.

#### Requirements
------------
Web-Bluetooth is behind an experimental flag in Chrome 45+. Go to `chrome://flags/#enable-web-bluetooth` to enable the flag. Restart Chrome and you should be good to go.

Experiment with web-bluetooth on the following devices.
  * Linux      
  * ChromeOS
  * Android

Any Bluetooth Low Energy Heart Rate Monitor advertising the Heart Rate Service. We used the [Polar H7](http://www.amazon.com/Polar-Bluetooth-Fitness-Tracker-XX-Large/dp/B007S088F4/ref=sr_1_1?ie=UTF8&qid=1464890553&sr=8-1&keywords=polar+h7).

#### Installation
------------
First, fork this repo and then run:

```
$ npm install
$ npm run demo
$ open http://localhost:3000
```
#### Use
------------
Connect to any device by its Name or Name Prefix.
This demo uses four of the many methods in the [web-bluetooth](http://sabertooth-io.github.io/) library.

##### `new BluetoothDevice()`
##### `connect()`
##### `disconnect()`
##### `startNotifications()`

For more information, visit the [web-bluetooth](http://sabertooth-io.github.io/) docs.
