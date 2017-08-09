"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Alexa = require("alexa-sdk");
var ical = require('ical');
var utils = require('util');
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
// If modifying these scopes, delete your previously saved credentials
// at ~/credentials.json
var SCOPES = ['https://www.googleapis.com/auth/calendar'];
var TOKEN_DIR = './';
var TOKEN_PATH = TOKEN_DIR + 'credentials.json';
var calendarId = 'docassisthackithon@gmail.com';
var monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
var availableSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM"];
var NEW_EVENTSummary = 'Doctor appointment done via Alexa';
var NEW_EVENT = {
    'summary': NEW_EVENTSummary,
    'location': 'Kochi, Kerala, India',
    'description': 'Appointment with the doctor is confirmed, please visit the hospital on that time. Thank you, ',
    'start': {
        'dateTime': addMinutes(new Date(), 60).toISOString(),
        'timeZone': 'Asia/Kolkata',
    },
    'end': {
        'dateTime': addMinutes(new Date(), 120).toISOString(),
        'timeZone': 'Asia/Kolkata',
    },
    'recurrence': [],
    'attendees': [
        { 'email': 'predhin.sapru@cognizant.com' },
    ],
    'reminders': {
        'useDefault': true,
        'overrides': [],
    },
};
var salutation_doctor = "Hello Doctor, ";
var salutation_guest = "Hello Guest, ";
var states = {
    SEARCHMODE: '_SEARCHMODE',
    DESCRIPTION: '_DESKMODE',
    BOOKDOCTOR: "_BOOKDOCTOR"
};
var ailment = {
    EAR: 'ear',
    TOOTH: 'tooth',
    EYE: "eye"
};
// local variable holding reference to the Alexa SDK object
var alexa;
//OPTIONAL: replace with "amzn1.ask.skill.[your-unique-value-here]";
var APP_ID = "amzn1.ask.skill.7ca2d4d3-4547-424e-8abf-623a065c384f";
// URL to get the .ics from, in this instance we are getting from Stanford however this can be changed
var URL = "https://calendar.google.com/calendar/ical/docassisthackithon%40gmail.com/public/basic.ics";
// Skills name 
var skillName = "Doctor Appointment calendar:";
// Message when the skill is first called
var welcomeMessage = "You can ask for the appointments today. Search for appointments by date. or say help. Or you can also book a new appointment. What would you like? ";
// Message for help intent
var HelpMessage = "Here are some things you can say: Is there an appointment today? Is there an appointment on the 18th of July? What are the appointments next week? Are there any appointments tomorrow?  Or you can also book an appointments. What would you like to know?";
var descriptionStateHelpMessage = "Here are some things you can say: Tell me about event one";
// Used when there is no data within a time period
var NoDataMessage = "Sorry there aren't any appointments scheduled. Would you like to search again?";
var availableDoctors = "We have Doctors for One: Ear, Two: Tooth, Three: Eye. Give me an appropriate number for the ailment you want to book appointment.";
var NoDoctorAvailableForThat = "That doctor is not available. These are the doctors available: " + availableDoctors + "Try asking about another doctor";
// Used to tell user skill is closing
var shutdownMessage = "Ok see you again soon.";
// Message used when only 1 event is found allowing for difference in punctuation 
var oneEventMessage = "There is 1 appointment ";
// Message used when more than 1 event is found allowing for difference in punctuation 
var multipleEventMessage = "There are %d appointments ";
// text used after the number of events has been said
var scheduledEventMessage = "scheduled for this time frame. I've sent the details to your Alexa app: ";
var firstThreeMessage = "Here are the first %d. ";
// the values within the {} are swapped out for variables
var eventSummary = "The appointment %s is, %s at %s on %s ";
// Only used for the card on the companion app
var cardContentSummary = "%s. %s at %s on %s ";
// More info text
var haveEventsRepromt = "Give me an appointment number to hear more information.";
// Error if a date is out of range
var dateOutOfRange = "Date is out of range please choose another date";
// Error if a event number is out of range
var eventOutOfRange = "Appointment number is out of range please choose another event";
// Used when an event is asked for
var descriptionMessage = "Here's the description ";
// Used when an event is asked for
var killSkillMessage = "Ok, great, see you next time.";
var eventNumberMoreInfoText = "You can say the appointment number for more information.";
// used for title on companion app
var cardTitle = "Doctor Appointment";
var cardContent = "";
// output for Alexa
var output = "";
// doctor info
var doctors = [{
        "info": " is an experienced doctor having more than 10 years experience",
        "skill": "ear specialist",
        "name": "Doctor Ear",
        "type": ailment.EAR,
        "id": [5000]
    },
    {
        "info": " is an experienced doctor having more than 20 years experience",
        "skill": "tooth specialist",
        "name": "Doctor Tooth",
        "type": ailment.TOOTH,
        "id": [5001]
    },
    {
        "info": " is an experienced doctor having more than 30 years experience",
        "skill": "eye specialist",
        "name": "Doctor Eye",
        "type": ailment.EYE,
        "id": [5002]
    }
];
// emit state based on intent
function getIntent(state) {
    var intentString = "";
    switch (state) {
        case states.BOOKDOCTOR:
            intentString = ("bookDoctorForIntent");
            break;
        case states.DESCRIPTION:
            intentString = ("eventIntent");
            break;
        default:
            intentString = ("AMAZON.HelpIntent");
    }
    return intentString;
}
// stores events that are found to be in our date range
var relevantEvents = new Array();
// Adding session handlers
var newSessionHandlers = {
    'LaunchRequest': function () {
        //this.handler.state = states.SEARCHMODE;
        this.emit(':ask', skillName + " " + welcomeMessage, welcomeMessage);
    },
    "searchIntent": function () {
        this.handler.state = states.SEARCHMODE;
        this.emitWithState("searchIntent");
    },
    "bookDoctorIntent": function () {
        this.handler.state = states.BOOKDOCTOR;
        this.emitWithState("bookDoctorIntent");
    },
    'Unhandled': function () {
        this.handler.state = states.SEARCHMODE;
        this.emit(':ask', HelpMessage, HelpMessage);
    },
    'SessionEndedRequest': function () {
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, output);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    }
};
// create a new handler with a BOOKDOCTOR state
var startBookDoctorHandlers = Alexa.CreateStateHandler(states.BOOKDOCTOR, {
    'exitIntent': function () {
        this.handler.state = "";
        this.event.session.attributes = {};
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.YesIntent': function () {
        this.handler.state = states.BOOKDOCTOR;
        output = "Ok! tell about the new appointment. " + availableDoctors;
        haveEventsRepromt = output;
        cardTitle = "Book Appointment!";
        cardContent = haveEventsRepromt;
        this.emit(":askWithCard", output, haveEventsRepromt, cardTitle, cardContent);
    },
    'idIntent': function () {
        var idSlotValue = this.event.request.intent.slots.id.value;
        console.log(idSlotValue);
        if (idSlotValue != undefined) {
            // parse slot value
            var index = parseInt(idSlotValue);
            var currentLoggedUser = getUserInfo(index);
            this.event.session.attributes.id = index;
            this.handler.state = states.BOOKDOCTOR;
            output = (currentLoggedUser.isDoctor ? salutation_doctor : salutation_guest) + availableDoctors;
            haveEventsRepromt = output;
            cardTitle = "Book Appointment!";
            cardContent = haveEventsRepromt;
            this.emit(":askWithCard", output, haveEventsRepromt, cardTitle, cardContent);
        }
        else {
            output = "I'm sorry.  What is your id again please ?";
            haveEventsRepromt = output;
            cardTitle = "User Identification";
            cardContent = haveEventsRepromt;
            this.emit(":ask", output, haveEventsRepromt);
        }
    },
    'AMAZON.NoIntent': function () {
        this.event.session.attributes = {};
        this.emit(':tell', shutdownMessage);
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', output, HelpMessage);
    },
    'numberIntent': function () {
        var doctorIndexSlotValue = this.event.request.intent.slots.number.value;
        // check if id is available
        var id = this.event.session.attributes.id;
        console.log(doctorIndexSlotValue);
        if (id != undefined) {
            if (doctorIndexSlotValue != undefined) {
                // parse slot value
                var index = parseInt(doctorIndexSlotValue) - 1;
                var speechOutput, rePrompt, header, personality_trait, skill;
                if (!doctors[index]) {
                    speechOutput = NoDoctorAvailableForThat;
                    rePrompt = "Try asking about another doctor";
                    header = "Doctor not available";
                }
                else {
                    this.event.session.attributes.doctorIndex = index;
                    personality_trait = doctors[index].info;
                    skill = doctors[index].skill;
                    speechOutput = doctors[index].name + " is available. Doctor" + personality_trait + ". When do you want to book the appointment?";
                    rePrompt = "When do you want to book the appointment for " + doctors[index].skill + "?";
                    header = "Appointment";
                }
                this.emit(":askWithCard", speechOutput, rePrompt, cardTitle, speechOutput);
            }
            else {
                this.emit(":ask", "I'm sorry.  What day did you want me to look for appointment?", "I'm sorry.  What day did you want me to look for appointment?");
            }
        }
        else {
            // id not available
            this.emit('AMAZON.HelpIntent');
        }
    },
    'bookDoctorIntent': function () {
        var parent = this;
        parent.handler.state = states.BOOKDOCTOR;
        output = "Ok, I will book it for you. Could you please tell your Identification number(4 digit) ?";
        haveEventsRepromt = output;
        cardTitle = "Book Appointment!";
        cardContent = haveEventsRepromt;
        this.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
    },
    'bookDoctorDateIntent': function () {
        var parent = this;
        var slotValue = this.event.request.intent.slots.date.value;
        if (slotValue != undefined) {
            parent.handler.state = states.BOOKDOCTOR;
            parent.event.session.attributes.date = slotValue;
            // Read slot data and parse out a usable date 
            var eventDate = new Date(slotValue);
            var availableTime = [];
            var currentTime = "";
            var d = new Date();
            currentTime = d.getHours();
            currentTime = currentTime + ":" + d.getMinutes();
            var currentTimeWrapped = new Date(slotValue);
            currentTimeWrapped.setTime(new Date().getTime());
            var indianTimeZoneVal = currentTimeWrapped.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            currentTimeWrapped = new Date(indianTimeZoneVal);
            console.log(currentTimeWrapped);
            console.log("Ref Times:");
            for (var i = 0; i < availableSlots.length; i++) {
                var refTime = convertTime12to24(availableSlots[i]);
                var refTimeWrapped = new Date(Date.parse(slotValue + ' ' + refTime));
                console.log(refTimeWrapped);
                if (currentTimeWrapped < refTimeWrapped) {
                    availableTime.push(availableSlots[i]);
                }
            }
            console.log(availableTime);
            var doctor = { skill: "Physician", type: "general" };
            var doctorIndex = parent.event.session.attributes.doctorIndex;
            var id = parent.event.session.attributes.id;
            if (doctorIndex !== undefined && doctors[doctorIndex]) {
                doctor = doctors[doctorIndex];
            }
            /*var startTime = addMinutes(new Date(), 60);
            var endTime = addMinutes(new Date(), 90);
            NEW_EVENT.start.dateTime = startTime.toISOString();
            NEW_EVENT.end.dateTime = endTime.toISOString();*/
            if (availableTime.length > 0) {
                output = "Ok, " +
                    "these are the times available on " + eventDate.getDate() +
                    "th of " + monthNames[eventDate.getMonth()] +
                    ": " + availableTime.join(" ") +
                    " ; please tell your convenient time by responding with the time ?";
                haveEventsRepromt = output;
                cardTitle = "Appointment Time!";
                cardContent = haveEventsRepromt;
                alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
            }
            else {
                output = "Sorry, " +
                    "these are no slots available on " + eventDate.getDate() +
                    "th of " + monthNames[eventDate.getMonth()] +
                    ", please tell another date ?";
                haveEventsRepromt = output;
                cardTitle = "Appointment Date!";
                cardContent = haveEventsRepromt;
                alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
            }
        }
        else {
            this.emit(":ask", "I'm sorry.  Could you please repeat the date again", "I'm sorry.  Could you please repeat the date again");
        }
    },
    'bookDoctorTimeIntent': function () {
        var parent = this;
        var timeSlot = this.event.request.intent.slots.time.value;
        var slotValue = parent.event.session.attributes.date;
        if (slotValue != undefined && timeSlot != undefined) {
            parent.handler.state = states.BOOKDOCTOR;
            // Read slot data and parse out a usable date 
            //var twentyFourHourTime = tConvert(timeSlot);
            var startTime = setDateTime(new Date(slotValue), timeSlot);
            var endTime = setDateTime(new Date(slotValue), timeSlot);
            endTime.setMinutes(30);
            // Load client secrets from a local file.
            fs.readFile('client_secret.json', function processClientSecrets(err, content) {
                if (err) {
                    console.log('Error loading client secret file: ' + err);
                    alexa.emit(":ask", "I'm sorry.  Error occured", "Error loading client secret file!");
                    return;
                }
                else {
                    var doctor = { skill: "Physician", type: "general" };
                    var doctorIndex = parent.event.session.attributes.doctorIndex;
                    var id = parent.event.session.attributes.id;
                    if (doctorIndex !== undefined && doctors[doctorIndex]) {
                        doctor = doctors[doctorIndex];
                    }
                    var startTimeString = startTime.toISOString().split("T")[0] + "T" + prefixZero(startTime.getHours()) + ":" + prefixZero(startTime.getMinutes()) + ":00";
                    var endTimeString = endTime.toISOString().split("T")[0] + "T" + prefixZero(endTime.getHours()) + ":" + prefixZero(endTime.getMinutes()) + ":00";
                    NEW_EVENT.start.dateTime = startTimeString;
                    NEW_EVENT.end.dateTime = endTimeString;
                    output =
                        "Your appointment for " + doctor.skill + " is booked on " + startTime.getDate() +
                            "th of " + monthNames[startTime.getMonth()] +
                            " at this timing from: " + formatAMPM(startTime) +
                            " to " + formatAMPM(endTime) + ".";
                    NEW_EVENT.summary = "(" + id + ") " + " [" + doctor.type + "] " +
                        NEW_EVENTSummary + " for " + doctor.skill;
                    NEW_EVENT.description = output;
                    // Authorize a client with the loaded credentials, then call the
                    // Google Calendar API.
                    authorize(JSON.parse(content), function (auth) {
                        var calendar = google.calendar('v3');
                        calendar.events.insert({
                            auth: auth,
                            calendarId: calendarId,
                            sendNotifications: true,
                            resource: NEW_EVENT,
                        }, function (err, event) {
                            if (err) {
                                console.log('There was an error contacting the Calendar service: ' + err);
                                alexa.emit(":ask", "I'm sorry.  Error occured", "There was an error contacting the Calendar service!");
                                return;
                            }
                            else {
                                console.log('Event created: %s', event.htmlLink);
                                output = output + ", Do you wish to do create another appoitment, respond with yes or no ?";
                                haveEventsRepromt = output;
                                cardTitle = "Appointment Time!";
                                cardContent = haveEventsRepromt;
                                alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
                            }
                        });
                    });
                }
            });
        }
        else {
            this.emit(":ask", "I'm sorry.  Could you please repeat the date again", "I'm sorry.  Could you please repeat the date again");
        }
    },
    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, output);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        //var intentString = getIntent(this.handler.state);
        //this.emitWithState(intentString);
        this.handler.state = states.BOOKDOCTOR;
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});
// Create a new handler with a SEARCH state
var startSearchHandlers = Alexa.CreateStateHandler(states.SEARCHMODE, {
    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.emit(':ask', output, welcomeMessage);
    },
    'AMAZON.NoIntent': function () {
        this.event.session.attributes = {};
        this.emit(':tell', shutdownMessage);
    },
    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', output, HelpMessage);
    },
    /*
    'bookDoctorIntent': function () {
        var parent = this;
        // change state to description
        parent.handler.state = states.BOOKDOCTOR;
        output = availableDoctors;
        haveEventsRepromt = output;
        cardTitle = "Book Appointment!";
        cardContent = haveEventsRepromt;

        //if date do this
        this.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
    },*/
    'searchIntent': function () {
        var parent = this;
        // change state to description
        parent.handler.state = states.SEARCHMODE;
        var slotValue = this.event.request.intent.slots.date.value;
        if (slotValue == undefined) {
            var targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 10);
            var dd = targetDate.getDate();
            var mm = targetDate.getMonth() + 1; // 0 is January, so we must add 1
            var yyyy = targetDate.getFullYear();
            var dateString = mm + "/" + dd + "/" + yyyy;
            slotValue = dateString;
            this.event.session.attributes.upcoming = true;
        }
        if (this.event.session.attributes && this.event.session.attributes.id == undefined) {
            if (slotValue != undefined) {
                // set data in session
                this.event.session.attributes.date = slotValue;
                output = "Ok, I will tell your appointments, Could you please tell your Identification number(4 digit) ?";
                haveEventsRepromt = output;
                cardTitle = "Appointment Enquiry!";
                cardContent = haveEventsRepromt;
                //if date do this
                this.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
            }
            else {
                this.emit(":ask", "I'm sorry.  What day did you want me to look for appointment?", "I'm sorry.  What day did you want me to look for appointment?");
            }
        }
        else {
            this.event.session.attributes.date = slotValue;
            //this.emit(":ask", this.event.session.attributes.id, this.event.session.attributes.id);
            this.emitWithState("idIntent");
        }
    },
    'idIntent': function () {
        // Declare variables 
        var eventList = new Array();
        //var slotValue = /*this.event.request.intent.slots.date.value*/this.event.session.attributes.date;
        var slotValue = this.event.session.attributes.date;
        var id = this.event.request.intent.slots.id && this.event.request.intent.slots.id.value ?
            this.event.request.intent.slots.id.value : this.event.session.attributes.id;
        var parent = this;
        var info = {};
        var dataAvailable = false;
        var isUserDoctor = false;
        var currentLoggedUser;
        //if date do this
        if (slotValue != undefined && id != undefined) {
            currentLoggedUser = getUserInfo(id);
            this.event.session.attributes.id = parseInt(id);
            // Using the iCal library I pass the URL of where we want to get the data from.
            ical.fromURL(URL, {}, function (err, data) {
                // Loop through all iCal data found
                for (var k in data) {
                    var ev = data[k];
                    // check if data available for current user
                    dataAvailable = false;
                    info = getDataFromSummary(ev.summary);
                    console.log(info["id"]);
                    isUserDoctor = currentLoggedUser.isDoctor;
                    if (isUserDoctor) {
                        dataAvailable = info["type"] === currentLoggedUser.type ? true : false;
                    }
                    else {
                        dataAvailable = parseInt(info["id"]) === parseInt(id) ? true : false;
                    }
                    if (data.hasOwnProperty(k) && dataAvailable) {
                        // Pick out the data relevant to us and create an object to hold it.
                        var eventData = {
                            summary: removeTags(ev.summary),
                            location: removeTags(ev.location),
                            description: removeTags(ev.description),
                            start: ev.start
                        };
                        // add the newly created object to an array for use later.
                        eventList.push(eventData);
                    }
                }
                // Check we have data
                if (eventList.length > 0) {
                    // Read slot data and parse out a usable date 
                    var eventDate = getDateFromSlot(slotValue);
                    if (parent.event.session.attributes.upcoming) {
                        eventDate.startDate = new Date(); // set start date to now to search for upcoming appointments
                        eventDate.endDate = new Date(slotValue);
                    }
                    // Check we have both a start and end date
                    if (eventDate.startDate && eventDate.endDate) {
                        // initiate a new array, and this time fill it with events that fit between the two dates
                        relevantEvents = getEventsBeweenDates(eventDate.startDate, eventDate.endDate, eventList);
                        if (relevantEvents.length > 0) {
                            // change state to description
                            parent.handler.state = states.DESCRIPTION;
                            // Create output for both Alexa and the content card
                            var cardContent = "";
                            output = oneEventMessage;
                            if (relevantEvents.length > 1) {
                                output = utils.format(multipleEventMessage, relevantEvents.length);
                            }
                            output += scheduledEventMessage;
                            if (relevantEvents.length > 1) {
                                output += utils.format(firstThreeMessage, relevantEvents.length > 3 ? 3 : relevantEvents.length);
                            }
                            if (relevantEvents[0] != null) {
                                var date = new Date(relevantEvents[0].start);
                                output += utils.format(eventSummary, "One", removeTags(relevantEvents[0].summary), relevantEvents[0].location, date.toDateString() + ".");
                            }
                            if (relevantEvents[1]) {
                                var date = new Date(relevantEvents[1].start);
                                output += utils.format(eventSummary, "Two", removeTags(relevantEvents[1].summary), relevantEvents[1].location, date.toDateString() + ".");
                            }
                            if (relevantEvents[2]) {
                                var date = new Date(relevantEvents[2].start);
                                output += utils.format(eventSummary, "Three", removeTags(relevantEvents[2].summary), relevantEvents[2].location, date.toDateString() + ".");
                            }
                            for (var i = 0; i < relevantEvents.length; i++) {
                                var date = new Date(relevantEvents[i].start);
                                cardContent += utils.format(cardContentSummary, i + 1, removeTags(relevantEvents[i].summary), removeTags(relevantEvents[i].location), date.toDateString() + "\n\n");
                            }
                            output += eventNumberMoreInfoText;
                            output = (currentLoggedUser.isDoctor ? salutation_doctor : salutation_guest) + output;
                            cardContent = (currentLoggedUser.isDoctor ? salutation_doctor : salutation_guest) + cardContent;
                            alexa.emit(':askWithCard', output, haveEventsRepromt, cardTitle, cardContent);
                        }
                        else {
                            output = NoDataMessage;
                            alexa.emit(':ask', output, output);
                        }
                    }
                    else {
                        output = NoDataMessage;
                        alexa.emit(':ask', output, output);
                    }
                }
                else {
                    output = NoDataMessage;
                    alexa.emit(':ask', output, output);
                }
            });
        }
        else {
            this.emit(":ask", "I'm sorry.  What day did you want me to look for appointment?", "I'm sorry.  What day did you want me to look for appointment?");
        }
    },
    'AMAZON.HelpIntent': function () {
        this.handler.state = states.SEARCHMODE;
        output = HelpMessage;
        this.emit(':ask', output, output);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});
// Create a new handler object for description state
var descriptionHandlers = Alexa.CreateStateHandler(states.DESCRIPTION, {
    'numberIntent': function () {
        var repromt = " Would you like to hear another event?";
        var slotValue = this.event.request.intent.slots.number.value;
        // parse slot value
        var index = parseInt(slotValue) - 1;
        if (relevantEvents[index]) {
            // use the slot value as an index to retrieve description from our relevant array
            output = descriptionMessage + removeTags(relevantEvents[index].description);
            output += repromt;
            this.emit(':askWithCard', output, repromt, relevantEvents[index].summary, output);
        }
        else {
            this.emit(':tell', eventOutOfRange);
        }
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', descriptionStateHelpMessage, descriptionStateHelpMessage);
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },
    'AMAZON.NoIntent': function () {
        this.event.session.attributes = {};
        this.emit(':tell', shutdownMessage);
    },
    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        this.emit(':ask', eventNumberMoreInfoText, eventNumberMoreInfoText);
    },
    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },
    'Unhandled': function () {
        //var intentString = getIntent(this.handler.state);
        //this.emitWithState(intentString);
        this.handler.state = states.DESCRIPTION;
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});
//======== HELPER FUNCTIONS ==============
// Remove HTML tags from string
function removeTags(str) {
    if (str) {
        return str.replace(/<(?:.|\n)*?>/gm, '');
    }
}
// Given an AMAZON.DATE slot value parse out to usable JavaScript Date object
// Utterances that map to the weekend for a specific week (such as �this weekend�) convert to a date indicating the week number and weekend: 2015-W49-WE.
// Utterances that map to a month, but not a specific day (such as �next month�, or �December�) convert to a date with just the year and month: 2015-12.
// Utterances that map to a year (such as �next year�) convert to a date containing just the year: 2016.
// Utterances that map to a decade convert to a date indicating the decade: 201X.
// Utterances that map to a season (such as �next winter�) convert to a date with the year and a season indicator: winter: WI, spring: SP, summer: SU, fall: FA)
function getDateFromSlot(rawDate) {
    // try to parse data
    var date = new Date(Date.parse(rawDate));
    var result;
    // create an empty object to use later
    var eventDate = {
        startDate: {},
        endDate: {}
    };
    // if could not parse data must be one of the other formats
    if (isNaN(date)) {
        // to find out what type of date this is, we can split it and count how many parts we have see comments above.
        var res = rawDate.split("-");
        // if we have 2 bits that include a 'W' week number
        if (res.length === 2 && res[1].indexOf('W') > -1) {
            var dates = getWeekData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // if we have 3 bits, we could either have a valid date (which would have parsed already) or a weekend
        }
        else if (res.length === 3) {
            var dates = getWeekendData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // anything else would be out of range for this skill
        }
        else {
            eventDate["error"] = dateOutOfRange;
        }
        // original slot value was parsed correctly
    }
    else {
        eventDate["startDate"] = new Date(date).setUTCHours(0, 0, 0, 0);
        eventDate["endDate"] = new Date(date).setUTCHours(24, 0, 0, 0);
    }
    return eventDate;
}
// Given a week number return the dates for both weekend days
function getWeekendData(res) {
    if (res.length === 3) {
        var saturdayIndex = 5;
        var sundayIndex = 6;
        var weekNumber = res[1].substring(1);
        var weekStart = w2date(res[0], weekNumber, saturdayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);
        return {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}
function isDoctor(id) {
    return parseInt(id) === 5000;
}
function getUserInfo(id) {
    var type = "patient";
    switch (parseInt(id)) {
        case 5000:
            type = ailment.EAR;
            break;
        case 5001:
            type = ailment.TOOTH;
            break;
        case 5002:
            type = ailment.EYE;
            break;
        default:
            type = "patient";
    }
    return {
        isDoctor: parseInt(id) === 5000 || parseInt(id) === 5001 || parseInt(id) === 5002,
        type: type
    };
}
// Given a week number return the dates for both the start date and the end date
function getWeekData(res) {
    if (res.length === 2) {
        var mondayIndex = 0;
        var sundayIndex = 6;
        var weekNumber = res[1].substring(1);
        var weekStart = w2date(res[0], weekNumber, mondayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);
        return {
            startDate: weekStart,
            endDate: weekEnd,
        };
    }
}
// Used to work out the dates given week numbers
var w2date = function (year, wn, dayNb) {
    var day = 86400000;
    var j10 = new Date(year, 0, 10, 12, 0, 0), j4 = new Date(year, 0, 4, 12, 0, 0), mon1 = j4.getTime() - j10.getDay() * day;
    return new Date(mon1 + ((wn - 1) * 7 + dayNb) * day);
};
// Loops though the events from the iCal data, and checks which ones are between our start data and out end date
function getEventsBeweenDates(startDate, endDate, eventList) {
    var start = new Date(startDate);
    var end = new Date(endDate);
    var data = new Array();
    for (var i = 0; i < eventList.length; i++) {
        if (start <= eventList[i].start && end >= eventList[i].start) {
            data.push(eventList[i]);
        }
    }
    console.log("FOUND " + data.length + " appointments between those times");
    return data;
}
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
            getNewToken(oauth2Client, callback);
        }
        else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client);
        }
    });
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code) {
        rl.close();
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    });
}
/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    }
    catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}
/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
    var calendar = google.calendar('v3');
    calendar.events.list({
        auth: auth,
        calendarId: calendarId,
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
    }, function (err, response) {
        if (err) {
            console.log('The API returned an error: ' + err);
            return;
        }
        var events = response.items;
        if (events.length == 0) {
            console.log('No upcoming events found.');
        }
        else {
            console.log('Upcoming 10 events:');
            for (var i = 0; i < events.length; i++) {
                var event = events[i];
                var start = event.start.dateTime || event.start.date;
                console.log('%s - %s', start, event.summary);
            }
        }
    });
}
/**
 * Creates a new event on calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function createEvent(auth) {
    var calendar = google.calendar('v3');
    calendar.events.insert({
        auth: auth,
        calendarId: calendarId,
        resource: event,
    }, function (err, event) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
        }
        console.log('Event created: %s', event.htmlLink);
    });
}
function setDateTime(date, time) {
    var index = time.indexOf(":"); // replace with ":" for differently displayed time.
    var index2 = time.length - 1;
    var hours = time.substring(0, index);
    var minutes = time.substring(index + 1);
    var mer = time.substring(index2 + 1, time.length);
    hours = parseInt(hours);
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds("00");
    return date;
}
function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}
function getDataFromSummary(string) {
    var regExpId = /\(([^)]+)\)/;
    var regExpAilment = /\[(.*)\]/;
    var matchesId = regExpId.exec(string);
    var matchesAilment = regExpAilment.exec(string);
    var id = "", ailment = "";
    id = matchesId && matchesId[1] ? matchesId[1] : "";
    ailment = matchesAilment && matchesAilment[1] ? matchesAilment[1] : "";
    return { id: id, type: ailment };
}
function tConvert(time) {
    // Check correct time format and split into components
    time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];
    if (time.length > 1) {
        time = time.slice(1); // Remove full string match value
        time[5] = +time[0] < 12 ? ' AM' : ' PM'; // Set AM/PM
        time[0] = +time[0] % 12 || 12; // Adjust hours
    }
    return time.join(''); // return adjusted time or original string
}
function prefixZero(data) {
    data = "" + data;
    return data.length < 2 ? "0" + data : data;
}
function formatAMPM(date_obj) {
    // formats a javascript Date object into a 12h AM/PM time string
    var hour = date_obj.getHours();
    var minute = date_obj.getMinutes();
    var amPM = (hour > 11) ? " PM" : " AM";
    if (hour > 12) {
        hour -= 12;
    }
    else if (hour == 0) {
        hour = "12";
    }
    if (minute < 10) {
        minute = "0" + minute;
    }
    return hour + ":" + minute + amPM;
}
function convertTime12to24(time12h) {
    var _a = time12h.split(' '), time = _a[0], modifier = _a[1];
    var _b = time.split(':'), hours = _b[0], minutes = _b[1];
    if (hours === '12') {
        hours = '00';
    }
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }
    return hours + ':' + minutes;
}
/**
 * Bootstrap for Alexa
 */
var handler = (function () {
    function handler(event, context, callback) {
        alexa = Alexa.handler(event, context);
        alexa.APP_ID = APP_ID;
        //alexa.appId = APP_ID;
        alexa.registerHandlers(newSessionHandlers, startSearchHandlers, descriptionHandlers, startBookDoctorHandlers);
        alexa.execute();
    }
    return handler;
}());
exports.handler = handler;
