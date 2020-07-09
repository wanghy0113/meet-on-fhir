/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const calendar = require("./calendar.js");
const datastore = require("./datastore.js");
const user = require("./user.js");
const healthcare = require("./healthcare.js");

const settings = require("./settings.json");

const express = require("express");
const session = require("cookie-session");

const app = express();
app.use(express.static("static"));
app.use("/fhirclient", express.static("node_modules/fhirclient/build/"));
app.use("/jquery", express.static("node_modules/jquery/dist/"));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "session",
    keys: [settings.sessionCookieSecret],
    maxAge: 7 * 60 * 60 * 1000,
  })
);

const meetBaseUrl = "https://meet.google.com";

function error(response) {
  return function (err) {
    console.log(err);
    response.status(500).send(err);
  };
}

function debugLog(message) {
  if (settings.debugLogging) {
    console.log(message);
  }
}

function getMeetingUrl(encounter) {
	var url = null;
	if (encounter && encounter.meta && encounter.meta.tag) {
	  encounter.meta.tag.forEach((t) => {
		if (t.system == meetBaseUrl) {
		  url = `${meetBaseUrl}/${t.code}`;
		}
	  });
	}
	return url;
  }

function setMeetingUrl(encounter, url) {
	const meetCode = url.replace(meetBaseUrl, "").replace(/\//g, "");
	encounter.meta = {...encounter.meta}
	if(!encounter.meta.tag) {
		encounter.meta.tag = [];
	}
	encounter.meta.tag = [...encounter.meta.tag, { system: meetBaseUrl, code: meetCode }];
}

function simplifyEncounter(encounter) {
	return {resourceType: 'Encounter', status: encounter.status, period: encounter.period, id: encounter.id};
}

async function simplifyAndSyncEncounter(encounter) {
	encounter = simplifyEncounter(encounter);
		let e = await healthcare.readEncounter(encounter.id);
		if(e) {
			const meetingUrl = getMeetingUrl(e);
			if(meetingUrl) {
				setMeetingUrl(encounter, meetingUrl)
			}
		} 
		return encounter;
}

  app.get('/hangouts/:encounterId', async (request, response) => {
	try {
		const {encounterId} = request.params;
		const encounter = await healthcare.readEncounter(encounterId);
		const meetUrl = getMeetingUrl(encounter);
		if(meetUrl) {
			response.send({url: meetUrl});
			return;
		}
		response.send({});
	} catch(err) {
		error(response)(err);
	}
});

app.post('/hangouts', async (request, response) => {
	const encounter = await simplifyAndSyncEncounter(JSON.parse(request.body.encounter));
	const encounterId = encounter.id;
	try {
		let meetUrl = getMeetingUrl(encounter);
		if(meetUrl) {
			await healthcare.updateEncounter(encounter);
			response.send({url: meetUrl});
			return;
		}
		user.withCredentials(request, response, client => {
			calendar.createEvent(client, encounterId, async (err, url) => {
				if (err) {
					debugLog('ERROR: Provider calendar event create for encounter ' + encounterId + ' failed with error ' + err);
					response.status(500).send(err);
					return;
				}
				setMeetingUrl(encounter, url);
				try {
					let resp = await healthcare.updateEncounter(encounter);
					debugLog('Provider created calendar event for encounter ' + encounterId + ' with URL ' + url);
					response.send({url: url});
				} catch(err) {
					error(response)(err);
				}
			});
		});
	} catch(err) {
		error(response)(err);
	}
});

app.get("/authenticate", (request, response) => {
  user.authenticate(request, response);
});

app.get("/logout", (request, response) => {
  user.logout(request, response);
});

app.get("/settings", (request, response) => {
  response.send({ fhirClientId: settings.fhirClientId });
});

app.listen(process.env.PORT || 8080);
