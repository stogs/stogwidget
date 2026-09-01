/* From Homey SDK 2.0 docs: The file device.js is a representation of an already paired device on Homey */
'use strict';

const Homey = require('homey');
const owm = require('../../lib/owm_api_deprecated.js');
const intervalCurrent = 5;

class owmCurrent extends Homey.Device {

    async onInit() {
        let name = this.getName() + '_' + this.getData().id;
        this.log('device init: '+name);

        let settings = this.getSettings();

        settings["lat"] = this.homey.geolocation.getLatitude();
        settings["lon"] = this.homey.geolocation.getLongitude();
        settings["units"] = 'imperial';

        // updating settings object for settings dialogue
        this.setSettings({
                language: this.homey.i18n.getLanguage(),
                units: 'imperial',
                lat: this.homey.geolocation.getLatitude(),
                lon: this.homey.geolocation.getLongitude(),
            })
            .catch(this.error)

        // Flows
        this._flowTriggerConditionChanged = this.homey.flow.getDeviceTriggerCard('ConditionChanged');

        this._flowTriggerConditionDetailChanged = this.homey.flow.getDeviceTriggerCard('ConditionDetailChanged');

        this._flowTriggerWeatherChanged = this.homey.flow.getDeviceTriggerCard('WeatherChanged');

        this._flowTriggerWindBeaufortChanged = this.homey.flow.getDeviceTriggerCard('WindBeaufortChanged');

        this._flowTriggerWindDirectionCompassChanged = this.homey.flow.getDeviceTriggerCard('WindDirectionCompassChanged');

        //this._flowTriggerWindAngleChanged = this.homey.flow.getDeviceTriggerCard('WindAngleChanged')

        this._flowTriggerCloudinessChanged = this.homey.flow.getDeviceTriggerCard('CloudinessChanged');

        this._flowTriggerVisibilityChanged = this.homey.flow.getDeviceTriggerCard('VisibilityChanged');

        this._flowTriggerSnowChanged = this.homey.flow.getDeviceTriggerCard('SnowChanged');

        //run once to get the first data
        this.pollWeatherCurrent(settings);

    } // end onInit

    onAdded() {
        let id = this.getData().id;
        this.log('device added: ', id);

    } // end onAdded

    onDeleted() {

        let id = this.getData().id;
        clearInterval(this.pollingintervalcurrent);
        this.log('device deleted:', id);

    } // end onDeleted

    async setDeviceUnavailable(message){
        try{
            await this.setUnavailable(message);
        }
        catch (error){
            this.log("Error setting device unavailable: ", error.message);
        }
    }

    async setDeviceAvailable(){
        if ( !this.getAvailable() ){
            try{
                await this.setAvailable();
            }
            catch (error){
                this.log("Error setting device available: ", error.message);
            }
        }
    }

    pollWeatherCurrent(settings) {
        //run once, then at interval
        let pollminutes = 10;

        this.pollingintervalcurrent = owm.setIntervalImmediately(_ => {
            this.pollOpenWeatherMapCurrent(settings)
        }, 60000 * pollminutes);
    }

    async pollOpenWeatherMapCurrent(settings) {

        owm.getURLCurrent(settings).then(url => {
                return owm.getWeatherData(url);
            })
            .then(async data => {
                if (!data || !data.weather || data.cod != 200){
                    if (data.message && data.cod>200){
                        this.log("API error message!");
                        this.log(data);
                        this.setDeviceUnavailable(data.message);
                        return;
                    }
                    else{
                        this.log("No wether data found!");
                        this.setDeviceUnavailable(this.homey.__("device_unavailable_reason.no_api_result"));
                        return;
                    }
                }
                else{
                    this.setDeviceAvailable();
                }

                let device = this;
                let triggerList = [];
                this.log(device.getData().id +" Received OWM data");

                var GEOlocation = data.name + ", " + data.sys.country;

                this.setSettings({
                        GEOlocation: GEOlocation,
                    })
                    .catch(this.error);
                var conditioncode = data.weather[0].main;
                this.log("Main conditioncode: " + data.weather[0].main);

                var conditioncode_detail = data.weather[0].id;
                this.log("Specific conditioncode: " + data.weather[0].id);

                var temp = data.main.temp;
                var hum = data.main.humidity;
                var pressure = data.main.pressure;
                // return the rain in mm if present, or precipitation
                if (data.precipitation) {
                    var rain = data.precipitation.value;
                }

                if (data.snow != undefined) {
                    if (typeof (data.snow) === "number") {
                        var snow = data.snow
                    } else if (typeof (data.snow) === "object") {
                        if (data.snow['3h'] != undefined) {
                            var snow = data.snow['3h'] / 3;
                        }
                        if (data.snow['1h'] != undefined) {
                            var snow = data.snow['1h'];
                        }
                        // Sometimes OWM returns an empty snow object
                        if (Object.keys(data.snow).length == 0) {
                            var snow = 0;
                        }
                    }
                } else {
                    var snow = 0;
                }

                if (data.rain != undefined) {
                    if (typeof (data.rain) === "number") {
                        var rain = data.rain
                    } else if (typeof (data.rain) === "object") {
                        if (data.rain['3h'] != undefined) {
                            var rain = data.rain['3h'] / 3;
                        }
                        if (data.rain['1h'] != undefined) {
                            var rain = data.rain['1h'];
                        }
                        // Sometimes OWM returns an empty rain object
                        if (Object.keys(data.rain).length == 0) {
                            var rain = 0;
                        }
                    }
                } else {
                    var rain = 0;
                }

                if (data.wind.speed) {
                    if (settings["units"] == "metric") {
                        // convert from m/s to km/h
                        var windstrength = Math.round(3.6 * data.wind.speed);
                    } else {
                        // windspeed in mph
                        var windstrength = data.wind.speed;
                    }
                } else {
                    var windstrength = {};
                }

                if (data.wind.deg) {
                    var windangle = data.wind.deg;
                    var winddegcompass = owm.degToCompass(windangle);
                    if (winddegcompass == undefined){
                        this.log("Could not get wind compass text for windangle: "+windangle);
                        winddegcompass = "";
                    }
                } else {
                    var windangle = null;
                    var winddegcompass = "";
                }
                if (settings["units"] == "metric") {
                    // convert to beaufort and concatenate in a string with wind direction
                    var windspeedbeaufort = owm.beaufortFromKmh(windstrength);
                    var windcombined = winddegcompass + " " + windspeedbeaufort;
                } else {
                    var windspeedbeaufort = owm.beaufortFromMph(windstrength);
                    var windcombined = winddegcompass + " " + windspeedbeaufort;
                }
                var cloudiness = data.clouds.all;
                var visibility = data.visibility;
                var description = data.weather[0].description;

                // var sunr = new -Date(data.sys.sunrise * 1e3);
                // var sunrise = sunr.getHours() + ":" + (sunr.getMinutes() < 10 ? '0' : '') + sunr.getMinutes();
                // var suns = new Date(data.sys.sunset * 1e3);
                // var sunset = suns.getHours() + ":" + (suns.getMinutes() < 10 ? '0' : '') + suns.getMinutes();
                let tz  = this.homey.clock.getTimezone();
                let sunr = new Date(data.sys.sunrise*1000).toLocaleString('de-DE', 
                { 
                    hour12: false, 
                    timeZone: tz,
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
                let sunrise = sunr.split(", ")[1];
                let suns = new Date(data.sys.sunset*1000).toLocaleString('de-DE', 
                { 
                    hour12: false, 
                    timeZone: tz,
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
                let sunset = suns.split(", ")[1];

                this.log("Comparing variables before and after current polling interval");

                if (this.getCapabilityValue('measure_windstrength_beaufort') !== windspeedbeaufort && windspeedbeaufort !== undefined) {
                    this.log("Windstrength previous: " + this.getCapabilityValue('measure_windstrength_beaufort'));
                    this.log("Windstrength new: " + windspeedbeaufort);
                    let state = {
                        "measure_windstrength_beaufort": windspeedbeaufort
                    };
                    let tokens = {
                        "measure_windstrength_beaufort": windspeedbeaufort,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerWindBeaufortChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerWindBeaufortChanged.trigger(device, tokens, state).catch(this.error)
                }
                if (this.getCapabilityValue('measure_wind_direction_string') !== winddegcompass && winddegcompass !== undefined) {
                    let state = {
                        "measure_wind_direction_string": winddegcompass
                    };
                    let tokens = {
                        "measure_wind_direction_string": winddegcompass,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerWindDirectionCompassChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerWindDirectionCompassChanged.trigger(device, tokens, state).catch(this.error)
                }
                //                if (this.getCapabilityValue('measure_wind_angle') !== windangle && windangle !== undefined) {
                //                    let state = {
                //                        "measure_wind_angle": windangle
                //                    };
                //                    let tokens = {
                //                        "measure_wind_angle": windangle,
                //                        "location": GEOlocation
                //                    };
                //                    this._flowTriggerWindAngleChanged.trigger(device, tokens).catch(this.error)
                //                    //this.setCapabilityValue('measure_wind_angle', winddegcompass).catch(this.error);
                //                }
                if (this.getCapabilityValue('measure_cloudiness') !== cloudiness && cloudiness !== undefined) {
                    this.log("cloudiness has changed. Previous cloudiness: " + this.getCapabilityValue('measure_cloudiness') + " New cloudiness: " + cloudiness);
                    let state = {
                        "measure_cloudiness": cloudiness
                    };
                    let tokens = {
                        "measure_cloudiness": cloudiness,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerCloudinessChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerCloudinessChanged.trigger(device, tokens, state).catch(this.error)
                }
                if (this.getCapabilityValue('measure_visibility') !== visibility && visibility !== undefined) {
                    this.log("visibility has changed. Previous visibility: " + this.getCapabilityValue('measure_visibility') + " New visibility: " + visibility);
                    let state = {
                        "measure_visibility": visibility
                    };
                    let tokens = {
                        "measure_visibility": visibility,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerVisibilityChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerVisibilityChanged.trigger(device, tokens, state).catch(this.error)
                }
                if (this.getCapabilityValue('measure_snow') !== snow && snow !== undefined) {
                    this.log("snow has changed. Previous snow: " + this.getCapabilityValue('measure_snow') + " New snow: " + snow);
                    let state = {
                        "measure_visibility": snow
                    };
                    let tokens = {
                        "measure_snow": snow,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerSnowChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerSnowChanged.trigger(device, tokens, snow).catch(this.error)
                }
                if (this.getCapabilityValue('conditioncode') !== conditioncode && conditioncode !== undefined) {
                    this.log("weathercondition has changed. Previous conditioncode: " + this.getCapabilityValue('conditioncode') + " New conditioncode: " + conditioncode);
                    let state = {
                        "conditioncode": conditioncode
                    };
                    let tokens = {
                        "conditioncode": conditioncode,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerConditionChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerConditionChanged.trigger(device, tokens, state).catch(this.error)
                }
                if (this.getCapabilityValue('conditioncode_detail') !== conditioncode_detail && conditioncode_detail !== undefined) {
                    this.log("Specific weatherconditioncode has changed. Previous conditioncode: " + this.getCapabilityValue('conditioncode_detail') + " New conditioncode: " + conditioncode_detail);
                    let state = {
                        "conditioncode": conditioncode_detail
                    };
                    let tokens = {
                        "conditioncode": conditioncode_detail,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerConditionDetailChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerConditionDetailChanged.trigger(device, tokens, state).catch(this.error)
                }
                if (this.getCapabilityValue('description') !== description && description !== undefined) {
                    this.log("description has changed. Previous description: " + this.getCapabilityValue('description') + " New description: " + description);
                    let state = {
                        "description": description
                    };
                    let tokens = {
                        "description": description,
                        "location": GEOlocation
                    };
                    triggerList.push({'trigger':this._flowTriggerWeatherChanged, 'device':device, 'token':tokens, 'state':state});
                    //this._flowTriggerWeatherChanged.trigger(device, tokens, state).catch(this.error)
                }

                // update each interval, even if unchanged.

                const capabilitySet = {
                    'conditioncode': conditioncode,
                    'conditioncode_detail': conditioncode_detail,
                    'measure_temperature': temp,
                    'measure_humidity': hum,
                    'measure_pressure': pressure,
                    'measure_rain': rain,
                    'measure_snow': snow,
                    'measure_wind_combined': windcombined,
                    'measure_wind_strength': windstrength,
                    'measure_wind_angle': windangle,
                    'measure_windstrength_beaufort': windspeedbeaufort,
                    'measure_wind_direction_string': winddegcompass,
                    'measure_cloudiness': cloudiness,
                    'measure_visibility': visibility,
                    'description': description,
                    'sunrise': sunrise,
                    'sunset': sunset
                };

                let capabilities = this.getCapabilities();
                for (let capability of capabilities) {
                            this.log("Capability: " + capability + ":" + capabilitySet[capability]);
                    if (capabilitySet[capability] != undefined) {
                        this.setCapabilityValue(capability, capabilitySet[capability]).catch(err => this.log(err.message));
                    } else {
                        this.log("Capability undefined: " + capability)
                    }
                };

                this.log("Trigger Flows...")
                for (let i=0; i<triggerList.length; i++){
                    triggerList[i].trigger.trigger(triggerList[i].device, triggerList[i].token, triggerList[i].state).catch(this.error).catch(err => this.log(err.message));
                }

            })
            .catch(error => {
                this.log(error);
            });
    }

    // parameters: {settings, newSettingsObj, changedKeysArr}
    onSettings(settings) {
        try {
            let newSettings = settings.oldSettings;
            for (let i = 0; i < settings.changedKeys.length; i++) {
                switch (settings.changedKeys[i]) {
                    case 'APIKey':
                        this.log('APIKey changed to ' + settings.newSettings.APIKey);
                        newSettings.APIKey = settings.newSettings.APIKey;
                        break;

                    case 'GEOlocationCity':
                        this.log('GEOlocationCity changed to ' + settings.newSettings.GEOlocationCity);
                        newSettings.GEOlocationCity = settings.newSettings.GEOlocationCity;
                        break;

                    case 'GEOlocationZip':
                        this.log('GEOlocationZip changed to ' + settings.newSettings.GEOlocationZip);
                        newSettings.GEOlocationZip = settings.newSettings.GEOlocationZip;
                        break;
                        
                    default:
                        this.log("Key not matched: " + i);
                        break;
                }
            }
            clearInterval(this.pollingintervalcurrent);
            this.pollWeatherCurrent(newSettings);
        } catch (error) {
            throw error;
        }
    }
}
module.exports = owmCurrent;