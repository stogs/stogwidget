'use strict';

const Homey = require('homey');
const owm = require('../../lib/owm_api.js');

class owmOnecallHourly extends Homey.Device {

    async onInit() {
        this.log('OnecallHourly init: ', this.getName(), this.getData().id);

        await this.updateCapabilities();

        await this.checkParentDevice();
        // // Intervall to check parent device is still existing
        // this.checkParentInterval = setInterval(_ => {
        //     this.checkParentDevice()
        // }, 60 * 1000 * 2);

        // this.data = require('./data.js').DATA_DEF;s
        this.data = 
        {
            "forecast_time":{
            },
            "description":{
                "trigger": "WeatherChanged"
            },
            "measure_temperature":{
                "trigger": "TemperatureChanged"
            },
            "measure_temperature_feelslike":{
                "trigger": "TemperatureFeelslikeChanged"
            },
            "measure_dew_point":{
                "trigger": "DewPointChanged"
            },
            "measure_humidity":{
                "trigger": "HumidityChanged"
            },
            "measure_pop":{
                "trigger": "PopChanged"
            },
            "measure_pressure":{
                "trigger": "PressureChanged"
            },
            "measure_cloudiness":{
                "trigger": "CloudinessChanged"
            },
            "measure_visibility":{
                "trigger": "VisibilityChanged"
            },
            "measure_wind_combined":{
                "trigger": "WindCombinedChanged"
            },
            "measure_wind_strength":{
                "trigger": "WindStrengthChanged"
            },
            "measure_wind_gust":{
                "trigger": "WindGustChanged"
            },
            "measure_ultraviolet":{
                "trigger": "UltravioletChanged"
            },
            "measure_rain":{
                "trigger": "RainChanged"
            },
            "measure_snow":{
                "trigger": "SnowChanged"
            },
            "conditioncode":{
                "trigger": "ConditionChanged"
            },
            "conditioncode_detail":{
                "trigger": "ConditionDetailChanged",
                "trigger_token": []
            },
            "measure_wind_angle":{
                "trigger": "WindAngleChanged"
            },
            "measure_wind_direction_string":{
                "trigger": "WindDirectionCompassChanged"
            },
            "measure_windstrength_beaufort":{
                "trigger": "WindBeaufortChanged"
            },
            "conditioncode_text":{
            }
        }
        

        // Flows
        this.registerFlowTrigger();

    } // end onInit

    async updateCapabilities(){
        // add missing capabilities
        let capabilities = [];
        try{
            capabilities = this.homey.app.manifest.drivers.filter((e) => {return (e.id == this.driver.id);})[0].capabilities;
        }
        catch (error){}
        for (let i=0; i<capabilities.length; i++){
            if (!this.hasCapability(capabilities[i])){
                await this.addCapability(capabilities[i]);
            }
        }

        if (this.hasCapability('moonphase_type')){
            await this.removeCapability('moonphase_type');
        }

    }

    async checkParentDevice(){
        // check if parent still exists
        let deviceList = this.homey.drivers.getDriver('owmOnecallCurrent').getDevices();
        let parentFound = false;
        for (let i=0; i<deviceList.length; i++){
            if (deviceList[i].getData().id == this.getData().locationId){
                parentFound = true;
            }
        }
        if (parentFound == false){
            this.setDeviceUnavailable(this.homey.__("device_unavailable_reason.location_not_available"));
        }        
    }

    onAdded() {
        this.log('device added: ',  this.getName(), this.getData().id);
    } // end onAdded

    onDeleted() {
        this.homey.clearInterval(this.checkParentInterval);
        this.log('device deleted:', this.getName(), this.getData().id);
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

        registerFlowTrigger(){
        let dataKeys = Object.keys(this.data);
        for(let i=0; i<dataKeys.length; i++){
            let item = this.data[dataKeys[i]]; 
            if (item.trigger != undefined){
                try{
                    item['trigger_instance'] = this.homey.flow.getDeviceTriggerCard(item.trigger);
                }
                catch(error){
                    this.log("Error registering trigger '", item.trigger, "': ", error.message);
                }
            }
        }
    }

    getDataCapability(capability){
        if (this.data == undefined){
            throw new Error("Device definition not found.");
        }
        if (this.data[capability] == undefined){
            throw new Error("Device definition not found for capability: "+capability);
        }
        return this.data[capability];
    }
    async updateDevice(hourlyData){
        if (this.data == undefined){
            this.log("No data definition found.");
            this.setDeviceUnavailable(this.homey.__("device_unavailable_reason.no_definition"));
            return;
        }
        let dataKeys = Object.keys(this.data);

        this.log(this.getName(), this.getData().id, " Received OWM hourly data");

        let units = 'imperial';
        let GEOlocation = this.getName();

        let hours = parseInt(this.getSetting("hours"));
        if (hours == null || hours < 0 || hours > 47){
            return;
        }
        if (hours == ''){
            hours = 0;
        }
        this.log("Hourly period: "+hours);
        let data = hourlyData[hours];
        if (!data){
            return;
        }

        let tz  = this.homey.clock.getTimezone();
        let forecast_time;
        let hasDateLocalization = this.homey.app.hasDateLocalization();
        if (hasDateLocalization){
            let now = new Date(data.dt*1000).toLocaleString(this.homey.i18n.getLanguage(), 
            { 
                hour12: false, 
                timeZone: tz,
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
            forecast_time = now.replace(',', '');;
        }
        else{
            let now = new Date(data.dt*1000).toLocaleString('en-US', 
                { 
                    hour12: false, 
                    timeZone: tz,
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                });
            let date = now.split(", ")[0];
            date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
            let time = now.split(", ")[1];
            forecast_time = date + " " + time;
        }
        this.getDataCapability('forecast_time')['value'] = forecast_time;

        this.getDataCapability('conditioncode')['value'] = data.weather[0].main;
        this.getDataCapability('conditioncode_text')['value'] = this.homey.app.getConditioncodeText(data.weather[0].main);

        this.getDataCapability('conditioncode_detail')['value'] = data.weather[0].id.toString();
        this.getDataCapability('conditioncode_detail').trigger_token.push({
            "trigger_token_id": "conditioncode",
            "trigger_token_value":data.weather[0].id
        })
        // this.getDataCapability('conditioncode_detail')['trigger_token_value'] = data.weather[0].id;

        this.getDataCapability('description')['value'] = data.weather[0].description;

        this.getDataCapability('measure_temperature')['value'] = Math.round(data.temp* 10) / 10;
        this.getDataCapability('measure_temperature_feelslike')['value'] = Math.round(data.feels_like* 10) / 10;

        this.getDataCapability('measure_humidity')['value'] = data.humidity;
        this.getDataCapability('measure_pressure')['value'] = data.pressure;
        this.getDataCapability('measure_dew_point')['value'] = Math.round(data.dew_point * 10) / 10;

        this.getDataCapability('measure_ultraviolet')['value'] = data.uvi;
        this.getDataCapability('measure_cloudiness')['value'] = data.clouds;
        this.getDataCapability('measure_pop')['value'] = Math.round(data.pop * 100);
        this.getDataCapability('measure_visibility')['value'] = data.visibility;

        // return the rain in mm if present, or precipitation
        let rain = 0;
        if (data.precipitation) {
            rain = data.precipitation.value;
        }
        if (data.rain != undefined) {
            if (typeof (data.rain) === "number") {
                rain = data.rain
            } else if (typeof (data.rain) === "object") {
                if (data.rain['3h'] != undefined) {
                    rain = data.rain['3h'] / 3;
                }
                if (data.rain['1h'] != undefined) {
                    rain = data.rain['1h'];
                }
                // Sometimes OWM returns an empty rain object
                if (Object.keys(data.rain).length == 0) {
                    rain = 0;
                }
            }
        } else {
            rain = 0;
        }
        this.getDataCapability('measure_rain')['value'] = rain;

        let snow = 0;
        if (data.snow != undefined) {
            if (typeof (data.snow) === "number") {
                snow = data.snow
            } else if (typeof (data.snow) === "object") {
                if (data.snow['3h'] != undefined) {
                    snow = data.snow['3h'] / 3;
                }
                if (data.snow['1h'] != undefined) {
                    snow = data.snow['1h'];
                }
                // Sometimes OWM returns an empty snow object
                if (Object.keys(data.snow).length == 0) {
                    snow = 0;
                }
            }
        } else {
            snow = 0;
        }
        this.getDataCapability('measure_snow')['value'] = snow;

        let windstrength = 0;
        if (data.wind_speed) {
            if ( this.getSetting('windspeed_ms') == true){
                if (units == "metric") {
                    windstrength = data.wind_speed;
                } else {
                    // mph to m/s
                    windstrength = Math.round(data.wind_speed / 2.237);
                }
            }
            else{
                if (units == "metric") {
                    // convert from m/s to km/h
                    windstrength = Math.round(3.6 * data.wind_speed);
                } else {
                    // windspeed in mph
                    windstrength = data.wind_speed;
                }
            }
        } else {
            windstrength = 0;
        }
        this.getDataCapability('measure_wind_strength')['value'] = windstrength;

        let windspeedbeaufort = 0;
        if (units == "metric") {
            // convert to beaufort and concatenate in a string with wind direction
            windspeedbeaufort = owm.beaufortFromKmh(windstrength);
        } else {
            windspeedbeaufort = owm.beaufortFromMph(windstrength);
        }
        this.getDataCapability('measure_windstrength_beaufort')['value'] = windspeedbeaufort;

        let windgust = 0;
        if (data.wind_gust) {
            if ( this.getSetting('windspeed_ms') == true){
                if (units == "metric") {
                    windgust = data.wind_gust;
                } else {
                    // mph to m/s
                    windgust = Math.round(data.wind_gust / 2.237);
                }
            }
            else{
                if (units == "metric") {
                    // convert from m/s to km/h
                    windgust = Math.round(3.6 * data.wind_gust);
                } else {
                    // windspeed in mph
                    windgust = data.wind_gust;
                }
            }
        } else {
            windgust = 0;
        }
        this.getDataCapability('measure_wind_gust')['value'] = windgust;

        let windangle = 0;
        let winddegcompass = "";
        if (data.wind_deg) {
            windangle = data.wind_deg;
            winddegcompass = owm.degToCompass(windangle);
            if (winddegcompass == undefined){
                this.log("Could not get wind compass text for windangle: "+windangle);
                winddegcompass = "";
            }

        }
        this.getDataCapability('measure_wind_angle')['value'] = windangle;
        this.getDataCapability('measure_wind_direction_string')['value'] = winddegcompass;

        let windcombined = windspeedbeaufort.toString();
        if (winddegcompass != ""){
            windcombined =  this.homey.__("windDirectionIcon."+winddegcompass) + 
                            " " + 
                            this.homey.__("windDirectionShort."+winddegcompass) + 
                            " " +
                            windspeedbeaufort.toString();
        }
        this.getDataCapability('measure_wind_combined')['value'] = windcombined;

        // CAPABILITIES: Compare values and update changed capabilities.
        // TRIGGER: Compare values to start trigger after capability update.
        for (let i=0; i<dataKeys.length; i++){
            let item = this.data[dataKeys[i]]; 
            let capability = dataKeys[i];
            if (dataKeys[i] != undefined){
                if (this.getCapabilityValue(capability) != item.value){
                    this.log(this.getName() + " Data changed: " + capability + ": " + this.getCapabilityValue(capability) + " => " + item.value);
                    if (item.value == undefined){
                        item.value = null;
                    }
                    await this.setCapabilityValue(capability, item.value);
                    // .catch(error => this.log(error.message));
                    // Store temporary value to trigger flows for changed capabilities
                    if (item.trigger != undefined){
                        item['trigger_start'] = true;
                    }
                }
            }
        }

        // TRIGGER: Trigger flows for changed capabilities
        for (let i=0; i<dataKeys.length; i++){
            let item = this.data[dataKeys[i]]; 
            let capability = dataKeys[i];
            if (item.trigger != undefined != undefined && item['trigger_start'] == true){
                let state = {};
                let token = {
                    "location": GEOlocation
                };
                if (item.trigger_token_id != undefined){
                    state[item.trigger_token_id] = item.trigger_token_value;
                    token[item.trigger_token_id] = item.trigger_token_value;
                }
                else if (item.trigger_token != undefined){
                    for (let j=0; j<item.trigger_token.length; j++){
                        state[item.trigger_token[j].trigger_token_id] = item.trigger_token[j].trigger_token_value;
                        token[item.trigger_token[j].trigger_token_id] = item.trigger_token[j].trigger_token_value;
                    }
                }
                else{
                    state[capability] = item.value;
                    token[capability] = item.value;
                }                   
                this.log(this.getName() + " Trigger flow: " + item.trigger);
                item['trigger_start'] = false;
                await item.trigger_instance.trigger(this, token, state)
                    .catch(error => this.log(error.message));
            }
        }
    }

    // parameters: {settings, newSettingsObj, changedKeysArr}
    onSettings(settings) {
        try {
            for (let i = 0; i < settings.changedKeys.length; i++) {
                switch (settings.changedKeys[i]) {
                    case "windspeed_ms":
                        this.log('windspeed_ms changed to '+settings.newSettings.windspeed_ms);
                        if ( settings.newSettings.windspeed_ms == true){
                            this.setCapabilityOptions( "measure_wind_strength", {"units": "m/s" } );

                            if ( this.homey.i18n.getUnits() == 'metric'){
                                this.setCapabilityValue("measure_wind_strength", 
                                    Math.round(this.getCapabilityValue("measure_wind_strength") * 10 / 3.6) / 10
                                );
                            }
                            else{
                                this.setCapabilityValue("measure_wind_strength", 
                                    Math.round(this.getCapabilityValue("measure_wind_strength") * 10 / 2.237) / 10
                                );
                            }

                        }
                        else{
                            if ( this.homey.i18n.getUnits() == 'metric'){
                                this.setCapabilityOptions( "measure_wind_strength", {"units": "km/h" } );
                                this.setCapabilityValue("measure_wind_strength", 
                                    Math.round(this.getCapabilityValue("measure_wind_strength") * 3.6)
                                );
                            }
                            else{
                                this.setCapabilityOptions( "measure_wind_strength", {"units": "mph" } );
                                this.setCapabilityValue("measure_wind_strength", 
                                    Math.round(this.getCapabilityValue("measure_wind_strength") * 2.237)
                                );
                            }
                        }
                        break;
                    default:
                        this.log("Ignore settings key: " + i + " " + settings.changedKeys[i]);
                        break;
                }
            }
        } catch (error) {
            throw error;
        }
    }

}
module.exports = owmOnecallHourly;