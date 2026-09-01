'use strict';

const Homey = require('homey');
const owm = require('../../lib/owm_api.js');

class owmOnecallDaily extends Homey.Device {

    async onInit() {
        this.log('OnecallDaily init: ', this.getName(), this.getData().id);

        await this.updateCapabilities();

        await this.checkParentDevice();
        // // Intervall to check parent device is still existing
        // this.checkParentInterval = this.homey.setInterval(_ => {
        //     this.checkParentDevice()
        // }, 60 * 1000 * 2);

        // this.data = require('./data.js').DATA_DEF;
        this.data = 
        {
            "forecast_time":{
            },
            "description":{
                "trigger": "WeatherChanged"
            },
            "summary":{
                "trigger": "SummaryChanged"
            },
            "measure_temperature_min":{
                "trigger": "TemperatureMinChanged"
            },
            "measure_temperature_max":{
                "trigger": "TemperatureMaxChanged"
            },
            "measure_temperature_morning":{
                "trigger": "TemperatureMorningChanged"
            },
            "measure_temperature_day":{
                "trigger": "TemperatureDayChanged"
            },
            "measure_temperature_evening":{
                "trigger": "TemperatureEveningChanged"
            },
            "measure_temperature_night":{
                "trigger": "TemperatureNightChanged"
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
            "measure_cloudiness":{
                "trigger": "CloudinessChanged"
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
            "measure_pressure":{
                "trigger": "PressureChanged"
            },
            "measure_rain":{
                "trigger": "RainChanged"
            },
            "measure_snow":{
                "trigger": "SnowChanged"
            },
            "sunrise":{
                "trigger": "SunriseChanged"
            },
            "sunset":{
                "trigger": "SunsetChanged"
            },
            "moonrise":{
                "trigger": "MoonriseChanged"
            },
            "moonset":{
                "trigger": "MoonsetChanged"
            },
            "moonphase_type":{
                "trigger": "MoonphaseChanged",
                "trigger_token": []
            },
            "moonphase":{
                "trigger": "MoonphaseValueChanged",
            },
            "measure_ultraviolet":{
                "trigger": "UltravioletChanged"
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

    async updateDevice(dailyData){
        if (this.data == undefined){
            this.log("No data definition found.");
            this.setDeviceUnavailable(this.homey.__("device_unavailable_reason.no_definition"));
            return;
        }
        let dataKeys = Object.keys(this.data);

        this.log(this.getName(), this.getData().id, " Received OWM daily data");

        let units = 'imperial';
        let GEOlocation = this.getName();

        let days = parseInt(this.getSetting("days"));
        if (days == null || days < 0 || days > 47){
            return;
        }
        if (days == ''){
            days = 0;
        }
        this.log("Daily period: "+days);
        let data = dailyData[days];
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

        if (data.weather != undefined){            
            this.getDataCapability('conditioncode')['value'] = data.weather[0].main;
            this.getDataCapability('conditioncode_text')['value'] = this.homey.app.getConditioncodeText(data.weather[0].main);

            this.getDataCapability('conditioncode_detail')['value'] = data.weather[0].id.toString();
            this.getDataCapability('conditioncode_detail').trigger_token.push({
                "trigger_token_id": "conditioncode",
                "trigger_token_value":data.weather[0].id
            })
            // this.getDataCapability('conditioncode_detail')['trigger_token_value'] = data.weather[0].id;

            this.getDataCapability('description')['value'] = data.weather[0].description;
        }
        else{
            this.getDataCapability('description')['value'] = null;
        }
        
        if ( data.summary != undefined){
            this.getDataCapability('summary')['value'] = data.summary;
        }
        else{
            this.getDataCapability('summary')['value'] = null;
        }

        this.getDataCapability('measure_temperature_min')['value'] = Math.round(data.temp.min * 10) / 10;
        this.getDataCapability('measure_temperature_max')['value'] = Math.round(data.temp.max * 10) / 10;
        this.getDataCapability('measure_temperature_morning')['value'] = Math.round(data.temp.morn * 10) / 10;
        this.getDataCapability('measure_temperature_day')['value'] = Math.round(data.temp.day * 10) / 10;
        this.getDataCapability('measure_temperature_evening')['value'] = Math.round(data.temp.eve * 10) / 10;
        this.getDataCapability('measure_temperature_night')['value'] = Math.round(data.temp.night * 10) / 10;

        this.getDataCapability('measure_humidity')['value'] = data.humidity;
        this.getDataCapability('measure_pressure')['value'] = data.pressure;

        if ( data.dew_point != undefined){
            this.getDataCapability('measure_dew_point')['value'] = Math.round(data.dew_point * 10) / 10;
        }
        else{
            this.getDataCapability('measure_dew_point')['value'] = null;
        }

        this.getDataCapability('measure_ultraviolet')['value'] = data.uvi;
        this.getDataCapability('measure_cloudiness')['value'] = data.clouds;

        if (data.pop != undefined){
            this.getDataCapability('measure_pop')['value'] = Math.round(data.pop * 100);
        }
        else{
            this.getDataCapability('measure_pop')['value'] = null;
        }
        
        let sunr = new Date(data.sunrise*1000).toLocaleString('en-US', 
        { 
            hour12: false, 
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
        this.getDataCapability('sunrise')['value'] = sunr.split(", ")[1];

        let suns = new Date(data.sunset*1000).toLocaleString('en-US', 
        { 
            hour12: false, 
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
        this.getDataCapability('sunset')['value'] = suns.split(", ")[1];

        let moonr = new Date(data.moonrise*1000).toLocaleString('en-US', 
        { 
            hour12: false, 
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
        this.getDataCapability('moonrise')['value'] = moonr.split(", ")[1];

        let moons = new Date(data.moonset*1000).toLocaleString('en-US', 
        { 
            hour12: false, 
            timeZone: tz,
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
        this.getDataCapability('moonset')['value'] = moons.split(", ")[1];

        let moonphase = data.moon_phase;
        let moonphase_type = '';
        if ( moonphase >= 0 && moonphase <= 0.063 ){
            moonphase_type = 'NM';
        }
        else if ( moonphase > 0.063 && moonphase <= 0.188 ){
            moonphase_type = 'ZS';
        }
        else if ( moonphase > 0,188 && moonphase <= 0.313 ){
            moonphase_type = 'ZH';
        }
        else if ( moonphase > 0.313 && moonphase <= 0.438 ){
            moonphase_type = 'ZM';
        }
        else if ( moonphase > 0.438 && moonphase <= 0.563 ){
            moonphase_type = 'VM';
        }
        else if ( moonphase > 0.563 && moonphase <= 0.688 ){
            moonphase_type = 'AM';
        }
        else if ( moonphase > 0.688 && moonphase <= 0.813 ){
            moonphase_type = 'AH';
        }
        else if ( moonphase > 0.813 && moonphase <= 0.938 ){
            moonphase_type = 'AS';
        }
        else if ( moonphase > 0.938 && moonphase <= 1 ){
            moonphase_type = 'NM';
        }
        this.getDataCapability('moonphase')['value'] = moonphase;
        this.getDataCapability('moonphase_type')['value'] = moonphase_type;
        this.getDataCapability('moonphase_type').trigger_token.push({
            "trigger_token_id": "moonphase_type",
            "trigger_token_value": moonphase_type
        })
        this.getDataCapability('moonphase_type').trigger_token.push({
            "trigger_token_id": "moonphase",
            "trigger_token_value": moonphase
        })

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
        } 
        else {
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
module.exports = owmOnecallDaily;