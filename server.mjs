import express from "express"
import fetch from "node-fetch";
import path from 'path';

const app = express();
const PORT = 3000;

const STRAVA_CLIENT_ID = '59286';
const STRAVA_CLIENT_SECRET = '15b4bb49da6be708e05fcfe75e1b969eea50010f';
const REDIRECT_URI = 'http://localhost:3000/strava-redirect';

let accessToken = '';
let isAuthorized = false;  


app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.get('/authorize', (req, res) => {
    const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
    const SCOPE = 'read';

    res.redirect(`${STRAVA_AUTH_URL}?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=${SCOPE},activity:read,activity:read_all`);
});

app.get('/strava-redirect', async (req, res) => {
    const authorizationCode = req.query.code;

    if (!authorizationCode) {
     
        return res.redirect('http://localhost:3000/error?message=No authorization code provided.');
    }

    try {
        const tokenData = await exchangeAuthorizationCodeForToken(authorizationCode);
     

        accessToken = tokenData.access_token;

        isAuthorized = true;
      
        res.redirect('/');
    } catch (error) {
      
        res.redirect(`/error.html?message=${encodeURIComponent(error.message)}`);
    }
});

app.get('/authorization-status', (req, res) => {
    res.json({ isAuthorized });
});

app.get('/athlete', async (req, res) => {
    if (!accessToken) {
        return res.redirect('/error.html?message=Access token not available.');
    }
    try {
        const athleteData = await fetchStravaData('https://www.strava.com/api/v3/athlete');
        res.json(athleteData);
    } catch (error) {
        res.json({ error: error.message });
    }
});


const STRAVA_BASE_URL = 'https://www.strava.com/api/v3';

app.get('/weekly-activities', async (req, res) => {
    if (!accessToken) {
        return res.redirect('/error.html?message=Access token not available.');
    }
    try {


        const startDate = getStartOfWeek(new Date());
        
        const response = await fetch(`${STRAVA_BASE_URL}/athlete/activities?after=${Math.floor(startDate.getTime()/1000)}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch activities from Strava');
        }

        const activities = await response.json();

        const formattedActivities = activities.map(activity => ({
            date: new Date(activity.start_date_local).toLocaleDateString(), 
            distance: (activity.distance / 1000).toFixed(2), // Convert meters to km
            moving_time: activity.moving_time,
            elevation_gain: activity.total_elevation_gain,
            average_speed: (activity.average_speed * 3.6).toFixed(2), // Convert m/s to km/h
            average_heart_rate: activity.average_heartrate,
            average_power: activity.average_watts,
            max_watts: activity.max_watts,
            kcals: activity.kilojoules 
        }));

        res.json(formattedActivities);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.get('/athlete/last-activity', async (req, res) => {
    if (!accessToken) {
        return res.redirect('/error.html?message=Access token not available.');
    }
    try {
        const activities = await fetchStravaData('https://www.strava.com/api/v3/athlete/activities?per_page=1');
        res.json(activities[0] || {});
    } catch (error) {
        res.json({ error: error.message });
    }
});


app.get('/athlete/week-stats', async (req, res) => {
    if (!accessToken) {
        return res.redirect('/error.html?message=Access token not available.');
    }
    try {
        const weekStartDate = getStartOfWeek(new Date());
        const activities = await fetchStravaData('https://www.strava.com/api/v3/athlete/activities?after=' + weekStartDate.getTime() / 1000);

        const weeklyStats = activities
            .filter(activity => new Date(activity.start_date_local).getTime() >= weekStartDate.getTime())
            .reduce((stats, activity) => {
                stats.totalDistance += activity.distance;
                stats.totalTime += activity.moving_time; 
                stats.totalHeartRate += activity.average_heartrate || 0; // Some activities might not have heart rate data
                stats.totalPower += activity.average_watts || 0; // Some activities might not have power data
                stats.activitiesCount += 1;
                stats.elevationGain += activity.total_elevation_gain;
                return stats;
            }, {
                totalDistance: 0,
                totalTime: 0,
                totalHeartRate: 0,
                totalPower: 0,
                activitiesCount: 0,
                elevationGain: 0
            });

   
        const averageSpeed = weeklyStats.totalTime ? weeklyStats.totalDistance / weeklyStats.totalTime : 0; // m/s
        const averageHeartRate = weeklyStats.activitiesCount ? weeklyStats.totalHeartRate / weeklyStats.activitiesCount : 0;
        const averagePower = weeklyStats.activitiesCount ? weeklyStats.totalPower / weeklyStats.activitiesCount : 0;

        res.json({
            totalDistanceInKm: weeklyStats.totalDistance / 1000,
            totalTimeInSeconds: weeklyStats.totalTime,
            averageSpeedKmH: averageSpeed * 3.6, // Convert m/s to km/h
            averageHeartRate: averageHeartRate,
            averagePower: averagePower,
            elevationGain: weeklyStats.elevationGain
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});


async function fetchStravaData(url) {
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!response.ok) {
        throw new Error('Failed to fetch Strava data.');
    }
    return await response.json();
}



async function exchangeAuthorizationCodeForToken(code) {
    const tokenExchangeUrl = 'https://www.strava.com/oauth/token';

    const response = await fetch(tokenExchangeUrl, {
        method: 'POST',
        body: JSON.stringify({
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to exchange authorization code for token');
    }

    return await response.json();
}

function getStartOfWeek(date) {
    const day = date.getDay();
    let diff;
    
    if(day === 0) { // If it's Sunday, go back 6 days
        diff = date.getDate() - 6;
    } else {  // For other days, go back to the nearest Monday
        diff = date.getDate() - day + 1;
    }
    
    // Set the date to the start of the week and reset the time to 12:00 AM
    const startOfWeek = new Date(date.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    return startOfWeek;
}



app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
