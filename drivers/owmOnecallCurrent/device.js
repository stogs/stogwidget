'use strict';

const { throws } = require('assert');
const Homey = require('homey');
const owm = require('../../lib/owm_api.js');
const intervalCurrent = 5;

class owmOnecallCurrent extends Homey.Device {

    async onInit() {
        this.log('OnecallCurrent init: ', this.getName(), this.getData().id);

        await this.updateCapabilities();

        // this.data = require('./data.js').DATA_DEF;
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

        let settings = await this.getSettings();
        if (!settings.pollingInterval || settings.pollingInterval == 0){
            settings.pollingInterval = intervalCurrent;
            this.setSettings(settings);
        }

        settings["units"] = 'imperial';
        settings["language"] = this._getLanguage(settings["language"]); // this.homey.i18n.getLanguage();

        // Flows
        this.registerFlowTrigger();

        // wait to get child devices ready
        await this._wait(2000);

        //run once to get the first data
        if (settings.pollingActive == true){
            this.setPollInterval(settings);
        }
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

    onAdded() {
        this.log('device added: ', this.getName(), this.getData().id);

    } // end onAdded

    onDeleted() {
        this.homey.clearInterval(this.pollinginterval);
        this.log('device deleted:', this.getName(), this.getData().id);
        this.homey.app.setChildDevicesUnavailable(id);
    } // end onDeleted

    async setDeviceUnavailable(message){
        try{
            await this.setUnavailable(message);
            let childList = this.homey.drivers.getDriver('owmOnecallHourly').getDevices();
            for (let i=0; i<childList.length; i++){
                if (childList[i].getData().locationId == this.getData().id){
                    await childList[i].setUnavailable(this.homey.__("device_unavailable_reason.location_not_available"));
                }
            }
            childList = this.homey.drivers.getDriver('owmOnecallDaily').getDevices();
            for (let i=0; i<childList.length; i++){
                if (childList[i].getData().locationId == this.getData().id){
                    await childList[i].setUnavailable(this.homey.__("device_unavailable_reason.location_not_available"));
                }
            }
            childList = this.homey.drivers.getDriver('owmOnecallAlerts').getDevices();
            for (let i=0; i<childList.length; i++){
                if (childList[i].getData().locationId == this.getData().id){
                    await childList[i].setUnavailable(this.homey.__("device_unavailable_reason.location_not_available"));
                }
            }
        }
        catch (error){
            this.log("Error setting device unavailable: ", error.message);
        }
    }

    async setDeviceAvailable(){
        if ( !this.getAvailable() ){
            try{
                await this.setAvailable();
                let childList = this.homey.drivers.getDriver('owmOnecallHourly').getDevices();
                for (let i=0; i<childList.length; i++){
                    if (childList[i].getData().locationId == this.getData().id){
                        await childList[i].setAvailable();
                    }
                }
                childList = this.homey.drivers.getDriver('owmOnecallDaily').getDevices();
                for (let i=0; i<childList.length; i++){
                    if (childList[i].getData().locationId == this.getData().id){
                        await childList[i].setAvailable();
                    }
                }
                childList = this.homey.drivers.getDriver('owmOnecallAlerts').getDevices();
                for (let i=0; i<childList.length; i++){
                    if (childList[i].getData().locationId == this.getData().id){
                        await childList[i].setAvailable();
                    }
                }
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

    setPollInterval(settings) {
        //run once, then at interval
        this.pollWeatherData(settings);
        this.pollinginterval = this.homey.setInterval(
            () => this.pollWeatherData(settings).catch(error => console.log(error)),
            ( 60 * 1000 * settings.pollingInterval) );
    }

    async pollWeatherData(settings) {
        if (this.data == undefined){
            this.log("No data definition found.");
            this.setDeviceUnavailable(this.homey.__("device_unavailable_reason.no_definition"));
            return;
        }
        let dataKeys = Object.keys(this.data);
        let data;
        try{

            // Special Map OneCall 4.0 calls and response mapping to 3.0 JSON definition
            if ( settings["APIVersion"] == "4.0" ){
                data = {};
                // current weather
                let url = owm.getOnecall40URL(settings, 'current');
                let data40 = await owm.getWeatherData(url);
                data["current"] = data40.data[0];
                data.current["dt"] = data40.data[0].dt;
                // daily forecast
                if ( this.hasChildDaily() ){
                    let url = owm.getOnecall40URL(settings, 'daily');
                    data40 = await owm.getWeatherData(url);
                    data["daily"] = data40.data;
                }
                // hourly forecast
                if ( this.hasChildHourly() ){
                    let url = owm.getOnecall40URL(settings, 'hourly');
                    data40 = await owm.getWeatherData(url);
                    data["hourly"] = data40.data;
                }
                // hourly alerts
                if ( this.hasChildAlerts() && data.current.alerts ){
                    data["alerts"] = [];
                    for ( let i=0; i< data.current.alerts.length; i++ ){
                        let url = owm.getOnecall40AlertURL(settings, data.current.alerts[i]);
                        data40 = await owm.getWeatherData(url);
                        data.alerts.push(data40);
                    }
                }
            }
            else {
                let url = owm.getOnecallURL(settings);
                data = await owm.getWeatherData(url);
            }
        }
        catch(error){
            this.log("Error reading OWM data:", error.message);
            this.log("Full Error: ", error);
            this.setDeviceUnavailable(this.homey.__("device_unavailable_reason.no_api_result: "+error.message));
            return;
        }
        if (!data || !data.current){
            if (data && data.message && data.cod>200){
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

        this.log(this.getName(), this.getData().id, " Received OWM data");

        //var GEOlocation = "Lat:" + data.lat + " Lon:" +data.lon;
        var GEOlocation = this.getName();
        let tz  = this.homey.clock.getTimezone();

        let forecast_time;
        let lastUpdate;
        let hasDateLocalization = this.homey.app.hasDateLocalization();
        if (hasDateLocalization){
            let now = new Date(data.current.dt*1000).toLocaleString(this.homey.i18n.getLanguage(), 
            { 
                hour12: false, 
                timeZone: tz,
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
            forecast_time = now.replace(',', '');

            now = new Date().toLocaleString(this.homey.i18n.getLanguage(), 
            { 
                hour12: false, 
                timeZone: tz,
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
            lastUpdate = now.replace(',', '');
        }
        else{
            let now = new Date(data.current.dt*1000).toLocaleString('en-US', 
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

            now = new Date().toLocaleString('en-US', 
            { 
                hour12: false, 
                timeZone: tz,
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
            date = now.split(", ")[0];
            date = date.split("/")[2] + "-" + date.split("/")[0] + "-" + date.split("/")[1]; 
            time = now.split(", ")[1];
            lastUpdate = date + " " + time;
            }

        this.setSettings({
            "APIState": lastUpdate
            })
            .catch(this.error);
                    
        this.getDataCapability('forecast_time')['value'] = forecast_time;

        this.getDataCapability('conditioncode')['value'] = data.current.weather[0].main;
        this.getDataCapability('conditioncode_text')['value'] = this.homey.app.getConditioncodeText(data.current.weather[0].main);

        this.getDataCapability('conditioncode_detail')['value'] = data.current.weather[0].id.toString();
        this.getDataCapability('conditioncode_detail').trigger_token.push({
            "trigger_token_id": "conditioncode",
            "trigger_token_value": data.current.weather[0].id
        })
        // this.getDataCapability('conditioncode_detail')['trigger_token_value'] = data.current.weather[0].id;

        this.getDataCapability('description')['value'] = data.current.weather[0].description;

        this.getDataCapability('measure_temperature')['value'] = Math.round(data.current.temp * 10) / 10;
        this.getDataCapability('measure_temperature_feelslike')['value'] = Math.round(data.current.feels_like* 10) / 10;

        this.getDataCapability('measure_humidity')['value'] = data.current.humidity;
        this.getDataCapability('measure_pressure')['value'] = data.current.pressure;
        this.getDataCapability('measure_dew_point')['value'] = Math.round(data.current.dew_point * 10) / 10;


        // return the rain in mm if present, or precipitation
        let rain = 0; 
        if (data.current.precipitation) {
            rain = data.current.precipitation.value;
        }
        if (data.current.rain != undefined) {
            if (typeof (data.current.rain) === "number") {
                rain = data.current.rain
            } else if (typeof (data.current.rain) === "object") {
                if (data.current.rain['3h'] != undefined) {
                    rain = data.current.rain['3h'] / 3;
                }
                if (data.current.rain['1h'] != undefined) {
                    rain = data.current.rain['1h'];
                }
                // Sometimes OWM returns an empty rain object
                if (Object.keys(data.current.rain).length == 0) {
                    rain = 0;
                }
            }
        } else {
            rain = 0;
        }
        this.getDataCapability('measure_rain')['value'] = rain;

        let snow = 0;
        if (data.current.snow != undefined) {
            if (typeof (data.current.snow) === "number") {
                snow = data.current.snow
            } else if (typeof (data.current.snow) === "object") {
                if (data.current.snow['3h'] != undefined) {
                    snow = data.current.snow['3h'] / 3;
                }
                if (data.current.snow['1h'] != undefined) {
                    snow = data.current.snow['1h'];
                }
                // Sometimes OWM returns an empty snow object
                if (Object.keys(data.current.snow).length == 0) {
                    snow = 0;
                }
            }
        } else {
            snow = 0;
        }
        this.getDataCapability('measure_snow')['value'] = snow;

        let windstrength = 0;
        if (data.current.wind_speed) {
            if ( this.getSetting('windspeed_ms') == true){
                if (settings["units"] == "metric") {
                    windstrength = data.current.wind_speed;
                } else {
                    // mph to m/s
                    windstrength = Math.round(data.current.wind_speed / 2.237);
                }
            }
            else{
                if (settings["units"] == "metric") {
                    // convert from m/s to km/h
                    windstrength = Math.round(3.6 * data.current.wind_speed);
                } else {
                    // windspeed in mph
                    windstrength = data.current.wind_speed;
                }
            }
        } else {
            windstrength = 0;
        }
        this.getDataCapability('measure_wind_strength')['value'] = windstrength;

        let windspeedbeaufort = 0;
        if (settings["units"] == "metric") {
            // convert to beaufort and concatenate in a string with wind direction
            windspeedbeaufort = owm.beaufortFromKmh(windstrength);
        } else {
            windspeedbeaufort = owm.beaufortFromMph(windstrength);
        }
        this.getDataCapability('measure_windstrength_beaufort')['value'] = windspeedbeaufort;

        let windgust = 0;
        if (data.current.wind_gust) {
            if ( this.getSetting('windspeed_ms') == true){
                if (settings["units"] == "metric") {
                    windgust = data.current.wind_gust;
                } else {
                    // mph to m/s
                    windgust = Math.round(data.current.wind_gust / 2.237);
                }
            }
            else{
                if (settings["units"] == "metric") {
                    // convert from m/s to km/h
                    windgust = Math.round(3.6 * data.current.wind_gust);
                } else {
                    // windspeed in mph
                    windgust = data.current.wind_gust;
                }
            }
        } else {
            windgust = 0;
        }
        this.getDataCapability('measure_wind_gust')['value'] = windgust;

        let windangle = 0;
        let winddegcompass = "";
        if (data.current.wind_deg) {
            windangle = data.current.wind_deg;
            winddegcompass = owm.degToCompass(windangle);
            if (winddegcompass == undefined){
                this.log("Could not get wind compass text for windangle: "+windangle);
                winddegcompass = "";
            }
        } else {
            windangle = 0;
            winddegcompass = "";
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

        this.getDataCapability('measure_cloudiness')['value'] = data.current.clouds;
        this.getDataCapability('measure_visibility')['value'] = data.current.visibility;
        this.getDataCapability('measure_ultraviolet')['value'] = data.current.uvi;

        let sunr = new Date(data.current.sunrise*1000).toLocaleString('en-US', 
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

        let suns = new Date(data.current.sunset*1000).toLocaleString('en-US', 
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

        // Update Hourly/daily/alerts
        if (data.hourly){
            await this.updateChildHourly(data.hourly)
        }
        if (data.daily){
            await this.updateChildDaily(data.daily)
        }
        if (data.alerts){
            await this.updateChildAlerts(data.alerts)
        }
        else{
            await this.updateChildAlerts([])
        }
    }

    hasChildHourly(){
        let devices = this.homey.drivers.getDriver('owmOnecallHourly').getDevices();
        for (let i=0; i<devices.length; i++){
            if (devices[i].getData().locationId == this.getData().id){
                return true;
            }
        }
        return false;
    }

    hasChildDaily(){
        let devices = this.homey.drivers.getDriver('owmOnecallDaily').getDevices();
        for (let i=0; i<devices.length; i++){
            if (devices[i].getData().locationId == this.getData().id){
                return true;
            }
        }
        return false;
    }

    hasChildAlerts(){
        let devices = this.homey.drivers.getDriver('owmOnecallAlerts').getDevices();
        for (let i=0; i<devices.length; i++){
            if (devices[i].getData().locationId == this.getData().id){
                return true;
            }
        }
        return false;
    }

    async updateChildHourly(data){
        let devices = this.homey.drivers.getDriver('owmOnecallHourly').getDevices();
        for (let i=0; i<devices.length; i++){
            if (devices[i].getData().locationId == this.getData().id){
                devices[i].updateDevice(data)
            }
        }
    }

    async updateChildDaily(data){
        let devices = this.homey.drivers.getDriver('owmOnecallDaily').getDevices();
        for (let i=0; i<devices.length; i++){
            if (devices[i].getData().locationId == this.getData().id){
                devices[i].updateDevice(data)
            }
        }
    }

    async updateChildAlerts(data){
        let devices = this.homey.drivers.getDriver('owmOnecallAlerts').getDevices();
        for (let i=0; i<devices.length; i++){
            if (devices[i].getData().locationId == this.getData().id){
                devices[i].updateDevice(data)
            }
        }
    }

    // parameters: {settings, newSettingsObj, changedKeysArr}
    onSettings(settings) {
        try {
            this.log("Settings changed");
            let newSettings = settings.oldSettings;
            for (let i = 0; i < settings.changedKeys.length; i++) {
                switch (settings.changedKeys[i]) {
                    case 'APIKey':
                        this.log('APIKey changed to ' + settings.newSettings.APIKey);
                        newSettings.APIKey = settings.newSettings.APIKey;
                        break;
                    case 'pollingActive':
                        this.log('pollingActive changed to ' + settings.newSettings.pollingActive);
                        newSettings.pollingActive = settings.newSettings.pollingActive;
                        break;
                    case 'pollingInterval':
                        this.log('pollingInterval changed to ' + settings.newSettings.pollingInterval);
                        newSettings.pollingInterval = settings.newSettings.pollingInterval;
                        if (!newSettings.pollingInterval || newSettings.pollingInterval == 0){
                            newSettings.pollingInterval = intervalCurrent;
                        }
                        break;
                    case "windspeed_ms":
                        this.log('windspeed_ms changed to '+settings.newSettings.windspeed_ms);
                        if ( settings.newSettings.windspeed_ms == true){
                            this.setCapabilityOptions( "measure_wind_strength", {"units": "m/s" } );
                        }
                        else{
                            if ( this.homey.i18n.getUnits() == 'metric'){
                                this.setCapabilityOptions( "measure_wind_strength", {"units": "km/h" } );
                            }
                            else{
                                this.setCapabilityOptions( "measure_wind_strength", {"units": "mph" } );
                            }
                        }
                        break;
                    default:
                        this.log("Ignore settings key: " + i + " " + settings.changedKeys[i]);
                        break;
                }
            }
            newSettings["units"] = this.homey.i18n.getUnits();
            newSettings["language"] = this._getLanguage(settings.newSettings["language"]);// this.homey.i18n.getLanguage();    
            newSettings['lat'] = settings.newSettings['lat'];
            newSettings['lon'] = settings.newSettings['lon'];
            newSettings["APIKey"] = settings.newSettings["APIKey"];
            newSettings["APIVersion"] = settings.newSettings["APIVersion"];
            this.homey.clearInterval(this.pollinginterval);
            if (newSettings.pollingActive == true){
                this.setPollInterval(newSettings);
            }
        } catch (error) {
            throw error;
        }
    }

    // Flow action
    async updateDevice(){
        // Flow action for single update
        let settings = await this.getSettings();
        let newSettings = {};
        newSettings['lat'] = settings['lat'];
        newSettings['lon'] = settings['lon'];
        newSettings["APIKey"] = settings["APIKey"];
        newSettings["APIVersion"] = settings["APIVersion"];
        newSettings["units"] = this.homey.i18n.getUnits();
        newSettings["language"] = this._getLanguage(settings["language"]);// this.homey.i18n.getLanguage();
        this.pollWeatherData(newSettings);
    }

    _getLanguage(settingsLanguage) {
        if (settingsLanguage == '--' || settingsLanguage == undefined){
            return this.homey.i18n.getLanguage();
        }
        else{
            return settingsLanguage;
        }
    }

    _wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
module.exports = owmOnecallCurrent;