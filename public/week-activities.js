document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('activitiesTable').querySelector('tbody');

    try {
        const response = await fetch('/weekly-activities'); // Endpoint to retrieve weekly activities from your server
        const activities = await response.json();

        activities.forEach(activity => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = activity.date;
            row.insertCell().textContent = activity.distance;
            row.insertCell().textContent = activity.moving_time;
            row.insertCell().textContent = activity.elevation_gain;
            row.insertCell().textContent = activity.average_speed;
            row.insertCell().textContent = activity.average_heart_rate;
            row.insertCell().textContent = activity.average_power;
            row.insertCell().textContent = activity.max_watts;
            row.insertCell().textContent = activity.kcals;
        
        });
    } catch (error) {
        console.error('Failed to fetch activities', error);
    }
});
