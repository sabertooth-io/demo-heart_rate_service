(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var bluetooth = require('./bluetoothMap');
var errorHandler = require('./errorHandler');

/** BluetoothDevice -
  *
  * @method connect - Establishes a connection with the device
  * @method connected - checks apiDevice to see whether device is connected
  * @method disconnect - terminates the connection with the device and pauses all data stream subscriptions
  * @method getValue - reads the value of a specified characteristic
  * @method writeValue - writes data to a specified characteristic of the device
  * @method startNotifications - attempts to start notifications for changes to device values and attaches an event listener for each data transmission
  * @method stopNotifications - attempts to stop previously started notifications for a provided characteristic
  * @method addCharacteristic - adds a new characteristic object to bluetooth.gattCharacteristicsMapping
  * @method _returnCharacteristic - _returnCharacteristic - returns the value of a cached or resolved characteristic or resolved characteristic
  *
  * @param {object} filters - collection of filters for device selectin. All filters are optional, but at least 1 is required.
  *          .name {string}
  *          .namePrefix {string}
  *          .uuid {string}
  *          .services {array}
  *          .optionalServices {array} - defaults to all available services, use an empty array to get no optional services
  *
  * @return {object} Returns a new instance of BluetoothDevice
  *
  */

var BluetoothDevice = function () {
  function BluetoothDevice(requestParams) {
    _classCallCheck(this, BluetoothDevice);

    this.requestParams = requestParams;
    this.apiDevice = null;
    this.apiServer = null;
    this.cache = {};
  }

  _createClass(BluetoothDevice, [{
    key: 'connected',
    value: function connected() {
      return this.apiDevice ? this.apiDevice.gatt.connected : errorHandler('no_device');
    }

    /** connect - establishes a connection with the device
      *   
      * NOTE: This method must be triggered by a user gesture to satisfy the native API's permissions
      *
      * @return {object} - native browser API device server object
      */

  }, {
    key: 'connect',
    value: function connect() {
      var _this = this;

      var filters = this.requestParams;
      var requestParams = { filters: [] };
      var uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]/;

      if (!Object.keys(filters).length) {
        return errorHandler('no_filters');
      }
      if (filters.name) requestParams.filters.push({ name: filters.name });
      if (filters.namePrefix) requestParams.filters.push({ namePrefix: filters.namePrefix });
      if (filters.uuid) {
        if (!filters.uuid.match(uuidRegex)) {
          errorHandler('uuid_error');
        } else {
          requestParams.filters.push({ uuid: filters.uuid });
        }
      }
      if (filters.services) {
        (function () {
          var services = [];
          filters.services.forEach(function (service) {
            if (!bluetooth.gattServiceList.includes(service)) {
              console.warn(service + ' is not a valid service. Please check the service name.');
            } else {
              services.push(service);
            }
          });
          requestParams.filters.push({ services: services });
        })();
      }
      if (filters.optional_services) {
        filters.optional_services.forEach(function (service) {
          if (!bluetooth.gattServiceList.includes(service)) bluetooth.gattServiceList.push(service);
        });
      } else {
        requestParams.optionalServices = bluetooth.gattServiceList;
      }

      return navigator.bluetooth.requestDevice(requestParams).then(function (device) {
        _this.apiDevice = device;
        return device.gatt.connect();
      }).then(function (server) {
        _this.apiServer = server;
        return server;
      }).catch(function (err) {
        return errorHandler('user_cancelled', err);
      });
    }

    /** disconnect - terminates the connection with the device and pauses all data stream subscriptions
      * @return {boolean} - success
      *
      */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      this.apiServer.connected ? this.apiServer.disconnect() : errorHandler('not_connected');
      return this.apiServer.connected ? errorHandler('issue_disconnecting') : true;
    }

    /** getValue - reads the value of a specified characteristic
      *
      * @param {string} characteristic_name - GATT characteristic  name
      * @return {promise} -  resolves with an object that includes key-value pairs for each of the properties
      *                       successfully read and parsed from the device, as well as the
      *                       raw value object returned by a native readValue request to the
      *                       device characteristic.
      */

  }, {
    key: 'getValue',
    value: function getValue(characteristic_name) {
      var _this2 = this;

      if (!bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        return errorHandler('characteristic_error', null, characteristic_name);
      }

      var characteristicObj = bluetooth.gattCharacteristicsMapping[characteristic_name];

      if (!characteristicObj.includedProperties.includes('read')) {
        console.warn('Attempting to access read property of ' + characteristic_name + ',\n                    which is not a included as a supported property of the\n                    characteristic. Attempt will resolve with an object including\n                    only a rawValue property with the native API return\n                    for an attempt to readValue() of ' + characteristic_name + '.');
      }

      return new Promise(function (resolve, reject) {
        return resolve(_this2._returnCharacteristic(characteristic_name));
      }).then(function (characteristic) {
        return characteristic.readValue();
      }).then(function (value) {
        var returnObj = characteristicObj.parseValue ? characteristicObj.parseValue(value) : {};
        returnObj.rawValue = value;
        return returnObj;
      }).catch(function (err) {
        return errorHandler('read_error', err);
      });
    }

    /** writeValue - writes data to a specified characteristic of the device
      *
      * @param {string} characteristic_name - name of the GATT characteristic 
      *     https://www.bluetooth.com/specifications/assigned-numbers/generic-attribute-profile
      *
      * @param {string|number} value - value to write to the requested device characteristic
      *
      *
      * @return {boolean} - Result of attempt to write characteristic where true === successfully written
      */

  }, {
    key: 'writeValue',
    value: function writeValue(characteristic_name, value) {
      var _this3 = this;

      if (!bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        return errorHandler('characteristic_error', null, characteristic_name);
      }

      var characteristicObj = bluetooth.gattCharacteristicsMapping[characteristic_name];

      if (!characteristicObj.includedProperties.includes('write')) {
        console.warn('Attempting to access write property of ' + characteristic_name + ',\n                    which is not a included as a supported property of the\n                    characteristic. Attempt will resolve with native API return\n                    for an attempt to writeValue(' + value + ') to ' + characteristic_name + '.');
      }

      return new Promise(function (resolve, reject) {
        return resolve(_this3._returnCharacteristic(characteristic_name));
      }).then(function (characteristic) {
        return characteristic.writeValue(characteristicObj.prepValue ? characteristicObj.prepValue(value) : value);
      }).then(function (changedChar) {
        return true;
      }).catch(function (err) {
        return errorHandler('write_error', err, characteristic_name);
      });
    }

    /** startNotifications - attempts to start notifications for changes to device values and attaches an event listener for each data transmission
      *
      * @param {string} characteristic_name - GATT characteristic name
      * @param {callback} transmissionCallback - callback function to apply to each event while notifications are active
      *
      * @return
      *
      */

  }, {
    key: 'startNotifications',
    value: function startNotifications(characteristic_name, transmissionCallback) {
      var _this4 = this;

      if (!bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        return errorHandler('characteristic_error', null, characteristic_name);
      }

      var characteristicObj = bluetooth.gattCharacteristicsMapping[characteristic_name];
      var primary_service_name = characteristicObj.primaryServices[0];

      if (!characteristicObj.includedProperties.includes('notify')) {
        console.warn('Attempting to access notify property of ' + characteristic_name + ',\n                    which is not a included as a supported property of the\n                    characteristic. Attempt will resolve with an object including\n                    only a rawValue property with the native API return\n                    for an attempt to startNotifications() for ' + characteristic_name + '.');
      }

      return new Promise(function (resolve, reject) {
        return resolve(_this4._returnCharacteristic(characteristic_name));
      }).then(function (characteristic) {
        characteristic.startNotifications().then(function () {
          _this4.cache[primary_service_name][characteristic_name].notifying = true;
          return characteristic.addEventListener('characteristicvaluechanged', function (event) {
            var eventObj = characteristicObj.parseValue ? characteristicObj.parseValue(event.target.value) : {};
            eventObj.rawValue = event;
            return transmissionCallback(eventObj);
          });
        });
      }).catch(function (err) {
        return errorHandler('start_notifications_error', err, characteristic_name);
      });
    }

    /** stopNotifications - attempts to stop previously started notifications for a provided characteristic
      *
      * @param {string} characteristic_name - GATT characteristic name
      *
      * @return {boolean} success
      *
      */

  }, {
    key: 'stopNotifications',
    value: function stopNotifications(characteristic_name) {
      var _this5 = this;

      if (!bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        return errorHandler('characteristic_error', null, characteristic_name);
      }

      var characteristicObj = bluetooth.gattCharacteristicsMapping[characteristic_name];
      var primary_service_name = characteristicObj.primaryServices[0];

      if (this.cache[primary_service_name][characteristic_name].notifying) {
        return new Promise(function (resolve, reject) {
          return resolve(_this5._returnCharacteristic(characteristic_name));
        }).then(function (characteristic) {
          characteristic.stopNotifications().then(function () {
            _this5.cache[primary_service_name][characteristic_name].notifying = false;
            return true;
          });
        }).catch(function (err) {
          return errorHandler('stop_notifications_error', err, characteristic_name);
        });
      } else {
        return errorHandler('stop_notifications_not_notifying', null, characteristic_name);
      }
    }

    /**
      * addCharacteristic - adds a new characteristic object to bluetooth.gattCharacteristicsMapping
      *
      * @param {string} characteristic_name - GATT characteristic name or other characteristic
      * @param {string} primary_service_name - GATT primary service name or other parent service of characteristic
      * @param {array} propertiesArr - Array of GATT properties as Strings
      *
      * @return {boolean} - Result of attempt to add characteristic where true === successfully added
      */

  }, {
    key: 'addCharacteristic',
    value: function addCharacteristic(characteristic_name, primary_service_name, propertiesArr) {
      if (bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        return errorHandler('add_characteristic_exists_error', null, characteristic_name);
      }

      if (!characteristic_name || characteristic_name.constructor !== String || !characteristic_name.length) {
        return errorHandler('improper_characteristic_format', null, characteristic_name);
      }

      if (!bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        if (!primary_service_name || !propertiesArr) {
          return errorHandler('new_characteristic_missing_params', null, characteristic_name);
        }
        if (primary_service_name.constructor !== String || !primary_service_name.length) {
          return errorHandler('improper_service_format', null, primary_service_name);
        }
        if (propertiesArr.constuctor !== Array || !propertiesArr.length) {
          return errorHandler('improper_properties_format', null, propertiesArr);
        }

        console.warn(characteristic_name + ' is not yet fully supported.');

        bluetooth.gattCharacteristicsMapping[characteristic_name] = {
          primaryServices: [primary_service_name],
          includedProperties: propertiesArr
        };

        return true;
      }
    }

    /**
      * _returnCharacteristic - returns the value of a cached or resolved characteristic or resolved characteristic
      *
      * @param {string} characteristic_name - GATT characteristic name
      * @return {object|false} - the characteristic object, if successfully obtained
      */

  }, {
    key: '_returnCharacteristic',
    value: function _returnCharacteristic(characteristic_name) {
      var _this6 = this;

      if (!bluetooth.gattCharacteristicsMapping[characteristic_name]) {
        return errorHandler('characteristic_error', null, characteristic_name);
      }

      var characteristicObj = bluetooth.gattCharacteristicsMapping[characteristic_name];
      var primary_service_name = characteristicObj.primaryServices[0];

      if (this.cache[primary_service_name] && this.cache[primary_service_name][characteristic_name] && this.cache[primary_service_name][characteristic_name].cachedCharacteristic) {
        return this.cache[primary_service_name][characteristic_name].cachedCharacteristic;
      } else if (this.cache[primary_service_name] && this.cache[primary_service_name].cachedService) {
        this.cache[primary_service_name].cachedService.getCharacteristic(characteristic_name).then(function (characteristic) {
          _this6.cache[primary_service_name][characteristic_name] = { cachedCharacteristic: characteristic };
          return characteristic;
        }).catch(function (err) {
          return errorHandler('_returnCharacteristic_error', err, characteristic_name);
        });
      } else {
        return this.apiServer.getPrimaryService(primary_service_name).then(function (service) {
          _this6.cache[primary_service_name] = { 'cachedService': service };
          return service.getCharacteristic(characteristic_name);
        }).then(function (characteristic) {
          _this6.cache[primary_service_name][characteristic_name] = { cachedCharacteristic: characteristic };
          return characteristic;
        }).catch(function (err) {
          return errorHandler('_returnCharacteristic_error', err, characteristic_name);
        });
      }
    }
  }]);

  return BluetoothDevice;
}();

module.exports = BluetoothDevice;
},{"./bluetoothMap":2,"./errorHandler":3}],2:[function(require,module,exports){
'use strict';

var bluetoothMap = {
	gattCharacteristicsMapping: {
		battery_level: {
			primaryServices: ['battery_service'],
			includedProperties: ['read', 'notify'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.battery_level = value.getUint8(0);
				return result;
			}
		},
		blood_pressure_feature: {
			primaryServices: ['blood_pressure'],
			includedProperties: ['read']
		},
		body_composition_feature: {
			primaryServices: ['body_composition'],
			includedProperties: ['read']
		},
		bond_management_feature: {
			primaryServices: ['bond_management_feature'],
			includedProperties: ['read']
		},
		cgm_feature: {
			primaryServices: ['continuous_glucose_monitoring'],
			includedProperties: ['read']
		},
		cgm_session_run_time: {
			primaryServices: ['continuous_glucose_monitoring'],
			includedProperties: ['read']
		},
		cgm_session_start_time: {
			primaryServices: ['continuous_glucose_monitoring'],
			includedProperties: ['read', 'write']
		},
		cgm_status: {
			primaryServices: ['continuous_glucose_monitoring'],
			includedProperties: ['read']
		},
		csc_feature: {
			primaryServices: ['cycling_speed_and_cadence'],
			includedProperties: ['read'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var flags = value.getUint16(0);
				var wheelRevolutionDataSupported = flags & 0x1;
				var crankRevolutionDataSupported = flags & 0x2;
				var multipleSensDataSupported = flags & 0x3;
				var result = {};
				if (wheelRevolutionDataSupported) {
					result.wheel_revolution_data_supported = wheelRevolutionDataSupported ? true : false;
				}
				if (crankRevolutionDataSupported) {
					result.crank_revolution_data_supported = crankRevolutionDataSupported ? true : false;
				}
				if (multipleSensDataSupported) {
					result.multiple_sensors_supported = multipleSensDataSupported ? true : false;
				}
				return result;
			}
		},
		current_time: {
			primaryServices: ['current_time'],
			includedProperties: ['read', 'write', 'notify']
		},
		cycling_power_feature: {
			primaryServices: ['cycling_power'],
			includedProperties: ['read']
		},
		firmware_revision_string: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		hardware_revision_string: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		ieee_11073_20601_regulatory_certification_data_list: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		'gap.appearance': {
			primaryServices: ['generic_access'],
			includedProperties: ['read']
		},
		'gap.device_name': {
			primaryServices: ['generic_access'],
			includedProperties: ['read', 'write'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.device_name = '';
				for (var i = 0; i < value.byteLength; i++) {
					result.device_name += String.fromCharCode(value.getUint8(i));
				}
				return result;
			},
			prepValue: function prepValue(value) {
				var buffer = new ArrayBuffer(value.length);
				var preppedValue = new DataView(buffer);
				value.split('').forEach(function (char, i) {
					preppedValue.setUint8(i, char.charCodeAt(0));
				});
				return preppedValue;
			}
		},
		'gap.peripheral_preferred_connection_parameters': {
			primaryServices: ['generic_access'],
			includedProperties: ['read']
		},
		'gap.peripheral_privacy_flag': {
			primaryServices: ['generic_access'],
			includedProperties: ['read']
		},
		glucose_feature: {
			primaryServices: ['glucose'],
			includedProperties: ['read'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				var flags = value.getUint16(0);
				result.low_battery_detection_supported = flags & 0x1;
				result.sensor_malfunction_detection_supported = flags & 0x2;
				result.sensor_sample_size_supported = flags & 0x4;
				result.sensor_strip_insertion_error_detection_supported = flags & 0x8;
				result.sensor_strip_type_error_detection_supported = flags & 0x10;
				result.sensor_result_highLow_detection_supported = flags & 0x20;
				result.sensor_temperature_highLow_detection_supported = flags & 0x40;
				result.sensor_read_interruption_detection_supported = flags & 0x80;
				result.general_device_fault_supported = flags & 0x100;
				result.time_fault_supported = flags & 0x200;
				result.multiple_bond_supported = flags & 0x400;
				return result;
			}
		},
		http_entity_body: {
			primaryServices: ['http_proxy'],
			includedProperties: ['read', 'write']
		},
		glucose_measurement: {
			primaryServices: ['glucose'],
			includedProperties: ['notify'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var flags = value.getUint8(0);
				var timeOffset = flags & 0x1;
				var concentrationTypeSampleLoc = flags & 0x2;
				var concentrationUnits = flags & 0x4;
				var statusAnnunciation = flags & 0x8;
				var contextInformation = flags & 0x10;
				var result = {};
				var index = 1;
				if (timeOffset) {
					result.time_offset = value.getInt16(index, /*little-endian=*/true);
					index += 2;
				}
				if (concentrationTypeSampleLoc) {
					if (concentrationUnits) {
						result.glucose_concentraiton_molPerL = value.getInt16(index, /*little-endian=*/true);
						index += 2;
					} else {
						result.glucose_concentraiton_kgPerL = value.getInt16(index, /*little-endian=*/true);
						index += 2;
					}
				}
				return result;
			}
		},
		http_headers: {
			primaryServices: ['http_proxy'],
			includedProperties: ['read', 'write']
		},
		https_security: {
			primaryServices: ['http_proxy'],
			includedProperties: ['read', 'write']
		},
		intermediate_temperature: {
			primaryServices: ['health_thermometer'],
			includedProperties: ['read', 'write', 'indicate']
		},
		local_time_information: {
			primaryServices: ['current_time'],
			includedProperties: ['read', 'write']
		},
		manufacturer_name_string: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		model_number_string: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		pnp_id: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		protocol_mode: {
			primaryServices: ['human_interface_device'],
			includedProperties: ['read', 'writeWithoutResponse']
		},
		reference_time_information: {
			primaryServices: ['current_time'],
			includedProperties: ['read']
		},
		supported_new_alert_category: {
			primaryServices: ['alert_notification'],
			includedProperties: ['read']
		},
		body_sensor_location: {
			primaryServices: ['heart_rate'],
			includedProperties: ['read'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var val = value.getUint8(0);
				var result = {};
				switch (val) {
					case 0:
						result.location = 'Other';
					case 1:
						result.location = 'Chest';
					case 2:
						result.location = 'Wrist';
					case 3:
						result.location = 'Finger';
					case 4:
						result.location = 'Hand';
					case 5:
						result.location = 'Ear Lobe';
					case 6:
						result.location = 'Foot';
					default:
						result.location = 'Unknown';
				}
				return result;
			}
		},
		// heart_rate_control_point
		heart_rate_control_point: {
			primaryServices: ['heart_rate'],
			includedProperties: ['write'],
			prepValue: function prepValue(value) {
				var buffer = new ArrayBuffer(1);
				var writeView = new DataView(buffer);
				writeView.setUint8(0, value);
				return writeView;
			}
		},
		heart_rate_measurement: {
			primaryServices: ['heart_rate'],
			includedProperties: ['notify'],
			/**
   	* Parses the event.target.value object and returns object with readable
   	* key-value pairs for all advertised characteristic values
   	*
   	*	@param {Object} value Takes event.target.value object from startNotifications method
   	*
   	* @return {Object} result Returns readable object with relevant characteristic values
   	*
   	*/
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var flags = value.getUint8(0);
				var rate16Bits = flags & 0x1;
				var contactDetected = flags & 0x2;
				var contactSensorPresent = flags & 0x4;
				var energyPresent = flags & 0x8;
				var rrIntervalPresent = flags & 0x10;
				var result = {};
				var index = 1;
				if (rate16Bits) {
					result.heartRate = value.getUint16(index, /*little-endian=*/true);
					index += 2;
				} else {
					result.heartRate = value.getUint8(index);
					index += 1;
				}
				if (contactSensorPresent) {
					result.contactDetected = !!contactDetected;
				}
				if (energyPresent) {
					result.energyExpended = value.getUint16(index, /*little-endian=*/true);
					index += 2;
				}
				if (rrIntervalPresent) {
					var rrIntervals = [];
					for (; index + 1 < value.byteLength; index += 2) {
						rrIntervals.push(value.getUint16(index, /*little-endian=*/true));
					}
					result.rrIntervals = rrIntervals;
				}
				return result;
			}
		},
		serial_number_string: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		software_revision_string: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		supported_unread_alert_category: {
			primaryServices: ['alert_notification'],
			includedProperties: ['read']
		},
		system_id: {
			primaryServices: ['device_information'],
			includedProperties: ['read']
		},
		temperature_type: {
			primaryServices: ['health_thermometer'],
			includedProperties: ['read']
		},
		descriptor_value_changed: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['indicate', 'writeAux', 'extProp']
		},
		apparent_wind_direction: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.apparent_wind_direction = value.getUint16(0) * 0.01;
				return result;
			}
		},
		apparent_wind_speed: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.apparent_wind_speed = value.getUint16(0) * 0.01;
				return result;
			}
		},
		dew_point: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.dew_point = value.getInt8(0);
				return result;
			}
		},
		elevation: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.elevation = value.getInt8(0) << 16 | value.getInt8(1) << 8 | value.getInt8(2);
				return result;
			}
		},
		gust_factor: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.gust_factor = value.getUint8(0) * 0.1;
				return result;
			}
		},
		heat_index: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.heat_index = value.getInt8(0);
				return result;
			}
		},
		humidity: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};

				result.humidity = value.getUint16(0) * 0.01;
				return result;
			}
		},
		irradiance: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};

				result.irradiance = value.getUint16(0) * 0.1;
				return result;
			}
		},
		rainfall: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};

				result.rainfall = value.getUint16(0) * 0.001;
				return result;
			}
		},
		pressure: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.pressure = value.getUint32(0) * 0.1;
				return result;
			}
		},
		temperature: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.temperature = value.getInt16(0) * 0.01;
				return result;
			}
		},
		true_wind_direction: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.true_wind_direction = value.getUint16(0) * 0.01;
				return result;
			}
		},
		true_wind_speed: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.true_wind_speed = value.getUint16(0) * 0.01;
				return result;
			}
		},
		uv_index: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.uv_index = value.getUint8(0);
				return result;
			}
		},
		wind_chill: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.wind_chill = value.getInt8(0);
				return result;
			}
		},
		barometric_pressure_trend: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var val = value.getUint8(0);
				var result = {};
				switch (val) {
					case 0:
						result.barometric_pressure_trend = 'Unknown';
					case 1:
						result.barometric_pressure_trend = 'Continuously falling';
					case 2:
						result.barometric_pressure_trend = 'Continously rising';
					case 3:
						result.barometric_pressure_trend = 'Falling, then steady';
					case 4:
						result.barometric_pressure_trend = 'Rising, then steady';
					case 5:
						result.barometric_pressure_trend = 'Falling before a lesser rise';
					case 6:
						result.barometric_pressure_trend = 'Falling before a greater rise';
					case 7:
						result.barometric_pressure_trend = 'Rising before a greater fall';
					case 8:
						result.barometric_pressure_trend = 'Rising before a lesser fall';
					case 9:
						result.barometric_pressure_trend = 'Steady';
					default:
						result.barometric_pressure_trend = 'Could not resolve to trend';
				}
				return result;
			}
		},
		magnetic_declination: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};

				result.magnetic_declination = value.getUint16(0) * 0.01;
				return result;
			}
		},
		magnetic_flux_density_2D: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				//FIXME: need to find out if these values are stored at different byte addresses
				//       below assumes that values are stored at successive byte addresses
				result.magnetic_flux_density_x_axis = value.getInt16(0, /*little-endian=*/true) * 0.0000001;
				result.magnetic_flux_density_y_axis = value.getInt16(2, /*little-endian=*/true) * 0.0000001;
				return result;
			}
		},
		magnetic_flux_density_3D: {
			primaryServices: ['environmental_sensing'],
			includedProperties: ['read', 'notify', 'writeAux', 'extProp'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				//FIXME: need to find out if these values are stored at different byte addresses
				//       below assumes that values are stored at successive byte addresses
				result.magnetic_flux_density_x_axis = value.getInt16(0, /*little-endian=*/true) * 0.0000001;
				result.magnetic_flux_density_y_axis = value.getInt16(2, /*little-endian=*/true) * 0.0000001;
				result.magnetic_flux_density_z_axis = value.getInt16(4, /*little-endian=*/true) * 0.0000001;
				return result;
			}
		},
		tx_power_level: {
			primaryServices: ['tx_power'],
			includedProperties: ['read'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				result.tx_power_level = value.getInt8(0);
				return result;
			}
		},
		weight_scale_feature: {
			primaryServices: ['weight_scale'],
			includedProperties: ['read'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var result = {};
				var flags = value.getInt32(0);
				result.time_stamp_supported = flags & 0x1;
				result.multiple_sensors_supported = flags & 0x2;
				result.BMI_supported = flags & 0x4;
				switch (flags & 0x78 >> 3) {
					case 0:
						result.weight_measurement_resolution = 'Not specified';
					case 1:
						result.weight_measurement_resolution = 'Resolution of 0.5 kg or 1 lb';
					case 2:
						result.weight_measurement_resolution = 'Resolution of 0.2 kg or 0.5 lb';
					case 3:
						result.weight_measurement_resolution = 'Resolution of 0.1 kg or 0.2 lb';
					case 4:
						result.weight_measurement_resolution = 'Resolution of 0.05 kg or 0.1 lb';
					case 5:
						result.weight_measurement_resolution = 'Resolution of 0.02 kg or 0.05 lb';
					case 6:
						result.weight_measurement_resolution = 'Resolution of 0.01 kg or 0.02 lb';
					case 7:
						result.weight_measurement_resolution = 'Resolution of 0.005 kg or 0.01 lb';
					default:
						result.weight_measurement_resolution = 'Could not resolve';
				}
				switch (flags & 0x380 >> 7) {
					case 0:
						result.height_measurement_resolution = 'Not specified';
					case 1:
						result.height_measurement_resolution = 'Resolution of 0.1 meter or 1 inch';
					case 2:
						result.height_measurement_resolution = 'Resolution of 0.005 meter or 0.5 inch';
					case 3:
						result.height_measurement_resolution = 'Resolution of 0.001 meter or 0.1 inch';
					default:
						result.height_measurement_resolution = 'Could not resolve';
				}
				// Remaining flags reserved for future use
				return result;
			}
		},
		csc_measurement: {
			primaryServices: ['cycling_speed_and_cadence'],
			includedProperties: ['notify'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var flags = value.getUint8(0);
				var wheelRevolution = flags & 0x1; //integer = truthy, 0 = falsy
				var crankRevolution = flags & 0x2;
				var result = {};
				var index = 1;
				if (wheelRevolution) {
					result.cumulative_wheel_revolutions = value.getUint32(index, /*little-endian=*/true);
					index += 4;
					result.last_wheel_event_time_per_1024s = value.getUint16(index, /*little-endian=*/true);
					index += 2;
				}
				if (crankRevolution) {
					result.cumulative_crank_revolutions = value.getUint16(index, /*little-endian=*/true);
					index += 2;
					result.last_crank_event_time_per_1024s = value.getUint16(index, /*little-endian=*/true);
					index += 2;
				}
				return result;
			}
		},
		sensor_location: {
			primaryServices: ['cycling_speed_and_cadence'],
			includedProperties: ['read'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var val = value.getUint16(0);
				var result = {};
				switch (val) {
					case 0:
						result.location = 'Other';
					case 1:
						result.location = 'Top of show';
					case 2:
						result.location = 'In shoe';
					case 3:
						result.location = 'Hip';
					case 4:
						result.location = 'Front Wheel';
					case 5:
						result.location = 'Left Crank';
					case 6:
						result.location = 'Right Crank';
					case 7:
						result.location = 'Left Pedal';
					case 8:
						result.location = 'Right Pedal';
					case 9:
						result.location = 'Front Hub';
					case 10:
						result.location = 'Rear Dropout';
					case 11:
						result.location = 'Chainstay';
					case 12:
						result.location = 'Rear Wheel';
					case 13:
						result.location = 'Rear Hub';
					case 14:
						result.location = 'Chest';
					case 15:
						result.location = 'Spider';
					case 16:
						result.location = 'Chain Ring';
					default:
						result.location = 'Unknown';
				}
				return result;
			}
		},
		sc_control_point: {
			primaryServices: ['cycling_speed_and_cadence'],
			includedProperties: ['write', 'indicate'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				return result;
			}
		},
		cycling_power_measurement: {
			primaryServices: ['cycling_power'],
			includedProperties: ['notify'],
			parseValue: function parseValue(value) {
				value = value.buffer ? value : new DataView(value);
				var flags = value.getUint16(0);
				var pedal_power_balance_present = flags & 0x1;
				var pedal_power_reference = flags & 0x2;
				var accumulated_torque_present = flags & 0x4;
				var accumulated_torque_source = flags & 0x8;
				var wheel_revolution_data_present = flags & 0x10;
				var crank_revolution_data_present = flags & 0x12;
				var extreme_force_magnitude_present = flags & 0x12;
				var extreme_torque_magnitude_present = flags & 0x12;
				var extreme_angles_present = flags & 0x12;
				var top_dead_spot_angle_present = flags & 0x12;
				var bottom_dead_spot_angle_present = flags & 0x12;
				var accumulated_energy_present = flags & 0x12;
				var offset_compensation_indicator = flags & 0x12;
				var result = {};
				var index = 1;
				//Watts with resolution of 1
				result.instantaneous_power = value.getInt16(index);
				index += 2;
				if (pedal_power_reference) {
					//Percentage with resolution of 1/2
					result.pedal_power_balance = value.getUint8(index);
					index += 1;
				}
				if (accumulated_torque_present) {
					//Percentage with resolution of 1/2
					result.accumulated_torque = value.getUint16(index);
					index += 2;
				}
				if (wheel_revolution_data_present) {
					result.cumulative_wheel_revolutions = value.Uint32(index);
					index += 4;
					result.last_wheel_event_time_per_2048s = value.Uint16(index);
					index += 2;
				}
				if (crank_revolution_data_present) {
					result.cumulative_crank_revolutions = value.getUint16(index, /*little-endian=*/true);
					index += 2;
					result.last_crank_event_time_per_1024s = value.getUint16(index, /*little-endian=*/true);
					index += 2;
				}
				if (extreme_force_magnitude_present) {
					//Newton meters with resolution of 1 TODO: units?
					result.maximum_force_magnitude = value.getInt16(index);
					index += 2;
					result.minimum_force_magnitude = value.getInt16(index);
					index += 2;
				}
				if (extreme_torque_magnitude_present) {
					//Newton meters with resolution of 1 TODO: units?
					result.maximum_torque_magnitude = value.getInt16(index);
					index += 2;
					result.minimum_torque_magnitude = value.getInt16(index);
					index += 2;
				}
				if (extreme_angles_present) {
					//TODO: UINT12.
					//Newton meters with resolution of 1 TODO: units?
					// result.maximum_angle = value.getInt12(index);
					// index += 2;
					// result.minimum_angle = value.getInt12(index);
					// index += 2;
				}
				if (top_dead_spot_angle_present) {
					//Percentage with resolution of 1/2
					result.top_dead_spot_angle = value.getUint16(index);
					index += 2;
				}
				if (bottom_dead_spot_angle_present) {
					//Percentage with resolution of 1/2
					result.bottom_dead_spot_angle = value.getUint16(index);
					index += 2;
				}
				if (accumulated_energy_present) {
					//kilojoules with resolution of 1 TODO: units?
					result.accumulated_energy = value.getUint16(index);
					index += 2;
				}
				return result;
			}
		}
	},
	gattServiceList: ['alert_notification', 'automation_io', 'battery_service', 'blood_pressure', 'body_composition', 'bond_management', 'continuous_glucose_monitoring', 'current_time', 'cycling_power', 'cycling_speed_and_cadence', 'device_information', 'environmental_sensing', 'generic_access', 'generic_attribute', 'glucose', 'health_thermometer', 'heart_rate', 'human_interface_device', 'immediate_alert', 'indoor_positioning', 'internet_protocol_support', 'link_loss', 'location_and_navigation', 'next_dst_change', 'phone_alert_status', 'pulse_oximeter', 'reference_time_update', 'running_speed_and_cadence', 'scan_parameters', 'tx_power', 'user_data', 'weight_scale']
};

module.exports = bluetoothMap;
},{}],3:[function(require,module,exports){
"use strict";

/** errorHandler - Consolodates error message configuration and logic
*
* @param {string} errorKey - maps to a detailed error message
* @param {object} nativeError - the native API error object, if present
* @param {} alternate - 
*
*/
function errorHandler(errorKey, nativeError, alternate) {

		var errorMessages = {
				add_characteristic_exists_error: "Characteristic " + alternateParam + " already exists.",
				characteristic_error: "Characteristic " + alternateParam + " not found. Add " + alternateParam + " to device using addCharacteristic or try another characteristic.",
				connect_gatt: "Could not connect to GATT. Device might be out of range. Also check to see if filters are vaild.",
				connect_server: "Could not connect to server on device.",
				connect_service: "Could not find service.",
				disconnect_timeout: "Timed out. Could not disconnect.",
				disconnect_error: "Could not disconnect from device.",
				improper_characteristic_format: alternateParam + " is not a properly formatted characteristic.",
				improper_properties_format: alternateParam + " is not a properly formatted properties array.",
				improper_service_format: alternateParam + " is not a properly formatted service.",
				issue_disconnecting: "Issue disconnecting with device.",
				new_characteristic_missing_params: alternateParam + " is not a fully supported characteristic. Please provide an associated primary service and at least one property.",
				no_device: "No instance of device found.",
				no_filters: "No filters found on instance of Device. For more information, please visit http://sabertooth.io/#method-newdevice",
				no_read_property: "No read property on characteristic: " + alternateParam + ".",
				no_write_property: "No write property on this characteristic.",
				not_connected: "Could not disconnect. Device not connected.",
				parsing_not_supported: "Parsing not supported for characterstic: " + alternateParam + ".",
				read_error: "Cannot read value on the characteristic.",
				_returnCharacteristic_error: "Error accessing characteristic " + alternateParam + ".",
				start_notifications_error: "Not able to read stream of data from characteristic: " + alternateParam + ".",
				start_notifications_no_notify: "No notify property found on this characteristic: " + alternateParam + ".",
				stop_notifications_not_notifying: "Notifications not established for characteristic: " + alternateParam + " or you have not started notifications.",
				stop_notifications_error: "Issue stopping notifications for characteristic: " + alternateParam + " or you have not started notifications.",
				user_cancelled: "User cancelled the permission request.",
				uuid_error: "Invalid UUID. For more information on proper formatting of UUIDs, visit https://webbluetoothcg.github.io/web-bluetooth/#uuids",
				write_error: "Could not change value of characteristic: " + alternateParam + ".",
				write_permissions: alternateParam + " characteristic does not have a write property."
		};

		throw new Error(errorMessages[errorKey]);
		return false;
}

module.exports = errorHandler;
},{}],4:[function(require,module,exports){
module.exports = require('./dist/BluetoothDevice');

},{"./dist/BluetoothDevice":1}],5:[function(require,module,exports){
'use strict';

/*
* We require in the web-bluetooth library.
*/
var BluetoothDevice = require('web-bluetooth');

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
$('#connect').on('touchstart click', function (event) {
  var services = $('#serviceFilter').val();
  var name = $('#nameFilter').val();
  var prefix = 'P';
  var filterObj = {};
  if (services) filterObj['services'] = services;
  if (name) filterObj['name'] = name;
  if (prefix) filterObj['namePrefix'] = prefix;

  blue = new BluetoothDevice(filterObj);

  blue.connect().then(function (device) {
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
    };

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
    blue.startNotifications('heart_rate_measurement', function (e) {
      (function pulse(back) {
        $('#heart').animate({
          opacity: back ? 1 : 0.2
        }, 950, function () {
          pulse(!back);
        });
      })(false);
      $('#heart_rate').show();
      $('#bpm-value').text(e.heartRate + ' ');
      myLiveChart.addData([e.heartRate], ++latestLabel);
    }).catch(function (error) {
      console.log(error);
    });
  });
  $('#load').show();
});

/**
* The below callback function handles disconnecting from the device by calling the 'disconnect()' method.
* disconnect() returns a Boolean indicating whether disconnecting was successful or not.
*/
$('#disconnect').on('touchstart click', function (event) {
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
$('#cancel').on('click', function (event) {
  event.preventDefault();
  $('#load').hide();
  $('#connect').show();
  $('#disconnect').hide();
  if (blue.disconnect()) $('#status').text('Not connected');
});

},{"web-bluetooth":4}]},{},[5]);
