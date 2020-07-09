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

const settings = require('./settings.json');

const {google} = require('googleapis');

exports.readEncounter = async function(encounterId) {
    const auth = await google.auth.getClient({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
   
    
    const healthcare = google.healthcare('v1beta1');
    google.options({
        auth,
        //params: {id: encounterId},
      });
    const name = `${settings.fhirStore}/fhir/Encounter/${encounterId}`;
    let response;
    try {
       response = await healthcare.projects.locations.datasets.fhirStores.fhir.read({name});
    } catch (e) {
        if(e.response && e.response.status == 404) {
            return null;
        }
        throw e;
    }
    return response.data;
};

exports.createEncounter = async function(encounter) {
    const auth = await google.auth.getClient({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    const healthcare = google.healthcare({version: 'v1beta1', auth});    
    return await healthcare.projects.locations.datasets.fhirStores.fhir.create({parent: settings.fhirStore, type: 'Encounter', requestBody: encounter});
};

exports.updateEncounter = async function(encounter) {
    const auth = await google.auth.getClient({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    const healthcare = google.healthcare({version: 'v1beta1', auth});    
    const name = `${settings.fhirStore}/fhir/Encounter/${encounter.id}`
    return await healthcare.projects.locations.datasets.fhirStores.fhir.update({name, requestBody: encounter});
};
