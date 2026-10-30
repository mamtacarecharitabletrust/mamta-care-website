import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App';
import WebsiteUpdatesEmbed from './WebsiteUpdatesEmbed';
import './styles/website-updates.css';
import './styles/global.css';
createRoot(document.getElementById('root')).render(<BrowserRouter><App/><WebsiteUpdatesEmbed/></BrowserRouter>);
