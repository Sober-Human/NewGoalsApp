import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import CalendarHeatmap from 'react-native-calendar-heatmap';
import { LinearGradient } from 'react-native-linear-gradient';

const STREAK_DATA_KEY = '@streakData';

const colorScale = [
  '#efefef',
  '#c6e48b',
  '#7bc96f',
  '#49aa54',
  '#268841',
  '#196127',
];

// Helper to get date string in YYYY-MM-DD format (UTC to avoid timezone issues)
const getUTCDateString = (date) => {
    return date.toISOString().split('T')[0];
};

// Helper to calculate difference in days between two UTC dates
const diffInDays = (dateStr1, dateStr2) => {
    const dt1 = new Date(dateStr1 + 'T00:00:00Z');
    const dt2 = new Date(dateStr2 + 'T00:00:00Z');
    return Math.floor((dt1.getTime() - dt2.getTime()) / (1000 * 60 * 60 * 24));
};

// Define colors for heatmap
const heatmapColors = {
    partial: '#ffa726', // Orange - partial progress
    full: '#66bb6a'     // Green  - full progress
};


const StreaksScreen = () => {
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastCheckinDate, setLastCheckinDate] = useState(null);
  const [lastCheckinType, setLastCheckinType] = useState(null);
  // State for heatmap data
  const [heatmapData, setHeatmapData] = useState([]);
  const [canCheckinToday, setCanCheckinToday] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Heatmap Data:", heatmapData);
  }, [heatmapData]);

  const loadStreakData = useCallback(async () => {
    setLoading(true);
    try {
      const storedData = await AsyncStorage.getItem(STREAK_DATA_KEY);
      const todayStr = getUTCDateString(new Date());
      let data = storedData ? JSON.parse(storedData) : {
          currentStreak: 0,
          longestStreak: 0,
          lastCheckinDate: null,
          lastCheckinType: null,
          heatmapData: [] // Load heatmapData
      };

      let streakShouldBeReset = false;
      let canCheckIn = true;
      if (data.lastCheckinDate) {
          const daysDiff = diffInDays(todayStr, data.lastCheckinDate);
          if (daysDiff > 1) {
              streakShouldBeReset = true;
          }
          if (daysDiff === 0) {
               canCheckIn = false;
          }
      } 
      
      const currentCStreak = streakShouldBeReset ? 0 : data.currentStreak;

      setCurrentStreak(currentCStreak); 
      setLongestStreak(data.longestStreak || 0);
      setLastCheckinDate(data.lastCheckinDate);
      setLastCheckinType(data.lastCheckinType);
      setHeatmapData(data.heatmapData || []); // Load or initialize heatmapData
      setCanCheckinToday(canCheckIn); // Set check-in status

    } catch (e) {
      console.error("Failed to load streak data.", e);
      Alert.alert("Error", "Could not load streak data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
     useCallback(() => {
         let isActive = true;

         async function fetchStreakData() {
            setLoading(true);
            try {
                const storedData = await AsyncStorage.getItem(STREAK_DATA_KEY);
                const todayStr = getUTCDateString(new Date());
                let data = storedData ? JSON.parse(storedData) : {
                    currentStreak: 0,
                    longestStreak: 0,
                    lastCheckinDate: null,
                    lastCheckinType: null,
                    heatmapData: [] // Load heatmapData
                };

                let streakShouldBeReset = false;
                let canCheckIn = true;
                if (data.lastCheckinDate) {
                    const daysDiff = diffInDays(todayStr, data.lastCheckinDate);
                    if (daysDiff > 1) {
                        streakShouldBeReset = true;
                    }
                    if (daysDiff === 0) {
                        canCheckIn = false;
                    }
                } 
                
                const currentCStreak = streakShouldBeReset ? 0 : data.currentStreak;

                 // Prevent state update if component unmounted before async call finished
                if (isActive) {
                    setCurrentStreak(currentCStreak); 
                    setLongestStreak(data.longestStreak || 0);
                    setLastCheckinDate(data.lastCheckinDate);
                    setLastCheckinType(data.lastCheckinType);
                    setHeatmapData(data.heatmapData || []); // Load or initialize heatmapData
                    setCanCheckinToday(canCheckIn); 
                }

            } catch (e) {
                console.error("Failed to load streak data.", e);
                Alert.alert("Error", "Could not load streak data.");
            } finally {
               if (isActive) setLoading(false);
            }
         }

         fetchStreakData();

         return () => {
             isActive = false;
         };
     }, []) // Empty dependency array is correct here
  );

  const handleCheckin = async (type) => {
    if (!canCheckinToday) {
      Alert.alert("Already Done!", "You've already checked in for today.");
      return;
    }

    setLoading(true);
    const todayStr = getUTCDateString(new Date());
    
    let currentData = { currentStreak, longestStreak, lastCheckinDate, lastCheckinType };
    let heatmapEntries = []; // Need to reload heatmap entries for saving
    try {
        const storedData = await AsyncStorage.getItem(STREAK_DATA_KEY);
        if (storedData) { 
            const parsedData = JSON.parse(storedData);
            currentData = {
                currentStreak: parsedData.currentStreak,
                longestStreak: parsedData.longestStreak,
                lastCheckinDate: parsedData.lastCheckinDate,
                lastCheckinType: parsedData.lastCheckinType
            };
            heatmapEntries = parsedData.heatmapData || []; // Load existing entries
         }
    } catch (e) { /* Ignore load error */ }

    let updatedCurrentStreak = currentData.currentStreak || 0;
    let updatedLongestStreak = currentData.longestStreak || 0;
    let updatedHeatmapEntries = [...heatmapEntries];

    try {
        const lastCheckin = currentData.lastCheckinDate;
        const daysDiff = lastCheckin ? diffInDays(todayStr, lastCheckin) : Infinity;

        if (daysDiff === 1) {
            if (type === 'full') { updatedCurrentStreak += 1; }
        } else if (daysDiff > 1) { 
            if (type === 'full') { updatedCurrentStreak = 1; }
             else { updatedCurrentStreak = 0; } 
        } else if (daysDiff === 0) {
             Alert.alert("Error", "Already checked in today."); setLoading(false); return;
        }

        updatedLongestStreak = Math.max(updatedCurrentStreak, updatedLongestStreak);
        
        // Update heatmap entries array for storage
        const newHeatmapEntry = { date: todayStr, count: type === 'full' ? 2 : 1 };
        updatedHeatmapEntries = updatedHeatmapEntries.filter(d => d.date !== todayStr);
        updatedHeatmapEntries.push(newHeatmapEntry);

        const newData = {
            currentStreak: updatedCurrentStreak,
            longestStreak: updatedLongestStreak,
            lastCheckinDate: todayStr,
            lastCheckinType: type,
            heatmapData: updatedHeatmapEntries // Save heatmap data directly
        };

        await AsyncStorage.setItem(STREAK_DATA_KEY, JSON.stringify(newData));

        // Update state immediately
        setCurrentStreak(updatedCurrentStreak);
        setLongestStreak(updatedLongestStreak);
        setLastCheckinDate(todayStr);
        setLastCheckinType(type);
        setHeatmapData(updatedHeatmapEntries); // Update heatmap data state
        
        Alert.alert("Checked In!", `Progress recorded: ${type}.`); 

    } catch (e) {
        console.error("Failed to save check-in.", e);
        Alert.alert("Error", "Could not save check-in data.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Daily Check-in & Streaks</Text>

        <View style={styles.streakInfoContainer}>
            <View style={styles.streakBox}>
                <Text style={styles.streakLabel}>Current Streak</Text>
                <Text style={styles.streakValue}>{loading ? '-' : currentStreak}</Text>
            </View>
             <View style={styles.streakBox}>
                <Text style={styles.streakLabel}>Longest Streak</Text>
                <Text style={styles.streakValue}>{loading ? '-' : longestStreak}</Text>
            </View>
        </View>

        <View style={styles.checkinSection}>
            <Text style={styles.checkinTitle}>Log Today's Progress:</Text>
            {loading ? (
                <Text style={styles.loadingText}>Loading status...</Text>
            ) : canCheckinToday ? (
                <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                        style={[styles.checkinButton, styles.partialButton]}
                        onPress={() => handleCheckin('partial')} 
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>Progress Made (Maintain)</Text>
                    </TouchableOpacity>
                     <TouchableOpacity 
                        style={[styles.checkinButton, styles.fullButton]}
                        onPress={() => handleCheckin('full')}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>Fully Done (Increase)</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                 <Text style={styles.checkedInText}>👍 You've checked in for today!</Text>
            )}
        </View>

        <View style={styles.calendarHeatmapContainer}>
          {(() => {
            try {
              return (
                <CalendarHeatmap
                  data={heatmapData}
                  colorArray={Object.values(colorScale)}
                  startDate={new Date('2024-01-01')}
                  endDate={new Date()}
                  numDays={100}
                  showOutOfRangeDays={false}
                  onPress={(value) => {
                    if (value) {
                      Alert.alert(
                        `Streak Details`,
                        `Date: ${value.date}\nType: ${value.count === 2 ? 'Full' : value.count === 1 ? 'Partial' : 'None'}`
                      );
                    }
                  }}
                  ScrollViewComponent={ScrollView}
                />
              );
            } catch (error) {
              return <Text>Error: {error.message}</Text>;
            }
          })()}
        </View>


         <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  scrollContent: {
      padding: 15,
      alignItems: 'center',
      paddingBottom: 50, // Ensure scroll space
  },
   headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#333',
      marginBottom: 25,
      textAlign: 'center',
  },
  streakInfoContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '90%',
      marginBottom: 30,
      paddingVertical: 15,
      backgroundColor: '#fff',
      borderRadius: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 3,
  },
  streakBox: {
      alignItems: 'center',
  },
  streakLabel: {
      fontSize: 16,
      color: '#555',
      marginBottom: 5,
  },
  streakValue: {
      fontSize: 42,
      fontWeight: 'bold',
      color: '#f4511e', 
  },
  checkinSection: {
      width: '90%',
      alignItems: 'center',
      marginTop: 10,
  },
  checkinTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: '#444',
      marginBottom: 20,
  },
   buttonContainer: {
      width: '100%',
  },
   checkinButton: {
      paddingVertical: 15,
      borderRadius: 8,
      marginBottom: 15,
      alignItems: 'center',
       shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 4,
  },
  partialButton: {
      backgroundColor: heatmapColors.partial,
  },
  fullButton: {
      backgroundColor: heatmapColors.full,
  },
  buttonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
  },
  checkedInText: {
      fontSize: 18,
      color: '#4CAF50',
      fontWeight: 'bold',
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 15, // Keep margin below text
  },
  loadingText: {
      fontSize: 16,
      color: '#888',
      marginTop: 20,
  },
  calendarHeatmapContainer: {
      marginTop: 20,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#fff',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
      elevation: 2,
      overflow: 'hidden', // Clip shadow to bounds
  },
});

export default StreaksScreen;
