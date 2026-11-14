import React from 'react';
import ResourcePage from './ResourcePage.jsx';
import { roomDefinition } from './resourceDefinitions.jsx';

export function RoomsPage() { return <ResourcePage definition={roomDefinition} />; }
