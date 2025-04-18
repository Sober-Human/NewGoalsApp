import React from 'react';
import { Redirect } from 'expo-router';

const StartPage = () => {
  // Redirect to the initial tab screen
  return <Redirect href="/(tabs)/goals" />;
};

export default StartPage; 