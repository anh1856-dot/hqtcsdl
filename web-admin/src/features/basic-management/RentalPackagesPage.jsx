import React from 'react';
import ResourcePage from './ResourcePage.jsx';
import { packageDefinition } from './resourceDefinitions.jsx';

export function RentalPackagesPage() { return <ResourcePage definition={packageDefinition} />; }
