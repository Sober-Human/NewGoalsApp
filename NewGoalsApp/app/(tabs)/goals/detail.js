import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Button,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Keyboard 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Progress from 'react-native-progress'; 
// Use hooks from expo-router
import { useFocusEffect, useLocalSearchParams, useRouter, Stack } from 'expo-router'; 

// (Keep the getWeeksBetweenDates helper function as defined previously)
const getWeeksBetweenDates = (startDateStr, endDateStr) => {
    const weeks = {};
    let currentDate = new Date(startDateStr + 'T00:00:00Z'); 
    const endDate = new Date(endDateStr + 'T00:00:00Z');
    let weekIndex = 0;

    while (currentDate <= endDate) {
        const weekStart = new Date(currentDate);
        weekStart.setUTCDate(currentDate.getUTCDate() - currentDate.getUTCDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
        const actualWeekEnd = weekEnd > endDate ? endDate : weekEnd;
        const weekKey = `week_${weekIndex}`;
        weeks[weekKey] = {
            startDate: weekStart.toISOString().split('T')[0],
            endDate: actualWeekEnd.toISOString().split('T')[0],
            tasks: [] 
        };
        currentDate.setUTCDate(currentDate.getUTCDate() + 7);
        currentDate.setUTCDate(currentDate.getUTCDate() - currentDate.getUTCDay());
        weekIndex++;
    }
    return weeks;
};

// Removed navigation/route props
const GoalDetailScreen = () => { 
  // Get goalId from local search params (Expo Router)
  const { goalId } = useLocalSearchParams(); 
  const router = useRouter();
  const [goal, setGoal] = useState(null);
  const [newTaskTexts, setNewTaskTexts] = useState({}); 
  const [loading, setLoading] = useState(true);

  // Add router to dependency array if using it in effect (like for setOptions)
  useFocusEffect(
    useCallback(() => {
       let isActive = true; // Flag to prevent state updates if component unmounted

       async function fetchGoalDetails() {
           if (!goalId) {
               Alert.alert("Error", "Goal ID is missing.");
               if(router.canGoBack()) router.back();
               return;
           }
           setLoading(true);
           try {
             const storedGoals = await AsyncStorage.getItem('@goals');
             if (storedGoals !== null) {
               let goals = JSON.parse(storedGoals);
               const goalIndex = goals.findIndex(g => g.id === goalId);
               if (goalIndex !== -1) {
                   let currentGoal = goals[goalIndex];
                   let needsSave = false;
                   if (!currentGoal.weeks || typeof currentGoal.weeks !== 'object' || Object.keys(currentGoal.weeks).length === 0) {
                       console.log("Calculating/resetting weeks for goal:", currentGoal.name);
                       currentGoal.weeks = getWeeksBetweenDates(currentGoal.startDate, currentGoal.endDate);
                        goals[goalIndex] = currentGoal;
                        needsSave = true; // Mark that we need to save the updated goals array
                   } else {
                       // Ensure task arrays exist (can be done without needing save)
                       Object.keys(currentGoal.weeks).forEach(weekKey => {
                           if (!currentGoal.weeks[weekKey].tasks) {
                               currentGoal.weeks[weekKey].tasks = [];
                           }
                       });
                   }

                   if (needsSave) {
                        await AsyncStorage.setItem('@goals', JSON.stringify(goals));
                   }
                   
                   if (isActive) setGoal(currentGoal);

               } else { 
                   Alert.alert("Error", "Goal not found."); 
                   if(router.canGoBack()) router.back();
                }
             } else { 
                 Alert.alert("Error", "No goals found."); 
                 if(router.canGoBack()) router.back();
              }
           } catch (e) { 
               console.error(e); 
               Alert.alert("Error", "Failed load."); 
               if(router.canGoBack()) router.back();
           } finally { 
              if (isActive) setLoading(false); 
           }
       }

       fetchGoalDetails();

       return () => {
           isActive = false; // Cleanup function to set flag on unmount
       };
    }, [goalId, router]) // Dependencies remain the same
  );

  const saveGoalUpdates = useCallback(async (updatedGoal) => {
      try {
          const storedGoals = await AsyncStorage.getItem('@goals');
          let goals = storedGoals ? JSON.parse(storedGoals) : [];
          const goalIndex = goals.findIndex(g => g.id === updatedGoal.id);
          if (goalIndex !== -1) {
              goals[goalIndex] = updatedGoal;
              await AsyncStorage.setItem('@goals', JSON.stringify(goals));
          } else { Alert.alert("Error", "Save failed: Goal not found."); }
      } catch (e) { console.error(e); Alert.alert("Error", "Failed to save updates."); }
  }, []);

  // --- Task Management Functions (Keep existing logic) ---
  const handleAddTask = (weekKey) => {
    const textToAdd = newTaskTexts[weekKey]?.trim();
    if (!textToAdd) {
      Alert.alert("Input Needed", "Please enter a task description.");
      return;
    }
    const updatedGoal = { ...goal };
    const newTask = { id: Date.now().toString(), text: textToAdd, completed: false };
    if (!updatedGoal.weeks[weekKey].tasks) { updatedGoal.weeks[weekKey].tasks = []; }
    updatedGoal.weeks[weekKey].tasks.push(newTask);
    setGoal(updatedGoal); 
    saveGoalUpdates(updatedGoal);
    setNewTaskTexts(prev => ({ ...prev, [weekKey]: '' }));
    Keyboard.dismiss();
  };

  const handleToggleTask = (weekKey, taskId) => {
    const updatedGoal = { ...goal };
    const weekTasks = updatedGoal.weeks[weekKey].tasks;
    const taskIndex = weekTasks.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      weekTasks[taskIndex].completed = !weekTasks[taskIndex].completed;
      setGoal(updatedGoal); 
      saveGoalUpdates(updatedGoal);
    } else { console.warn(`Task ${taskId} not found in week ${weekKey}`); }
  };

  // --- Calculation Functions (Keep existing logic) ---
   const calculateProgress = useCallback(() => {
        if (!goal || !goal.weeks) return 0;
        let totalTasks = 0;
        let completedTasks = 0;
        Object.values(goal.weeks).forEach(week => {
            if (week.tasks) {
                 totalTasks += week.tasks.length;
                 completedTasks += week.tasks.filter(task => task.completed).length;
            }
        });
        return totalTasks === 0 ? 0 : completedTasks / totalTasks;
  }, [goal]);

   const isWeekComplete = useCallback((weekKey) => {
       if (!goal || !goal.weeks || !goal.weeks[weekKey] || !goal.weeks[weekKey].tasks) return false;
       const tasks = goal.weeks[weekKey].tasks;
       return tasks.length > 0 && tasks.every(task => task.completed);
   }, [goal]);

  if (loading || !goal) {
    return (
      <View style={styles.loadingContainer}>
         {/* Optionally set a dynamic title in the stack header */} 
        <Stack.Screen options={{ title: 'Loading...' }} /> 
        <Text>Loading Goal...</Text>
      </View>
    );
  }

  const formatDate = (dateStr) => {
      return new Date(dateStr + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  return (
    <SafeAreaView style={styles.container}>
       {/* Set the Stack Screen title dynamically once goal is loaded */}
       <Stack.Screen options={{ title: goal.name }} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* Removed goal title from here as it's in header */}
        <Text style={styles.goalDatesDisplay}>{`${formatDate(goal.startDate)} - ${formatDate(goal.endDate)}`}</Text>

        {/* Progress Bar (Keep existing logic) */} 
        <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Overall Progress:</Text>
            <Progress.Bar progress={calculateProgress()} width={null} color="#4CAF50" unfilledColor="#e0e0e0" borderWidth={0} height={10} borderRadius={5} />
            <Text style={styles.progressPercentage}>{`${Math.round(calculateProgress() * 100)}%`}</Text>
        </View>

        {/* Weekly Sections (Keep existing logic) */} 
        {Object.entries(goal.weeks || {}).sort(([keyA], [keyB]) => parseInt(keyA.split('_')[1]) - parseInt(keyB.split('_')[1])).map(([weekKey, weekData]) => (
          <View key={weekKey} style={styles.weekSection}>
            <View style={styles.weekHeader}>
                 <Text style={styles.weekTitle}>
                    Week {parseInt(weekKey.split('_')[1]) + 1}: {formatDate(weekData.startDate)} - {formatDate(weekData.endDate)}
                 </Text>
                 {isWeekComplete(weekKey) && <Text style={styles.tick}>✓</Text>} 
            </View>
            
            {/* Task List (Keep existing logic) */} 
            {(weekData.tasks || []).map((task) => (
                 <TouchableOpacity 
                    key={task.id} 
                    style={styles.taskItem} 
                    onPress={() => handleToggleTask(weekKey, task.id)}
                >
                    <View style={styles.checkbox}>
                         {task.completed && <View style={styles.checkboxInner} />} 
                    </View>
                    <Text style={[styles.taskText, task.completed && styles.taskTextCompleted]}>
                        {task.text}
                    </Text>
                 </TouchableOpacity>
            ))}
            {(weekData.tasks || []).length === 0 && (
                 <Text style={styles.noTasksText}>No tasks added for this week yet.</Text>
            )}

            {/* Add Task Input (Keep existing logic) */}
             <View style={styles.addTaskContainer}>
                 <TextInput 
                    style={styles.taskInput}
                    placeholder="Add a new task..."
                    value={newTaskTexts[weekKey] || ''} 
                    onChangeText={(text) => setNewTaskTexts(prev => ({ ...prev, [weekKey]: text }))}
                    onSubmitEditing={() => handleAddTask(weekKey)} 
                 />
                 <TouchableOpacity onPress={() => handleAddTask(weekKey)} style={styles.addButton}> 
                     <Text style={styles.addButtonText}>+</Text>
                 </TouchableOpacity>
             </View>
          </View>
        ))}
         <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles remain the same, except removed goalTitle style
const styles = StyleSheet.create({
   container: {
    flex: 1,
    backgroundColor: '#fff',
  },
   loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  // goalTitle removed - handled by Stack.Screen options
  goalDatesDisplay: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
      marginTop: 15, // Added top margin since title is gone
      marginBottom: 15, 
  },
  progressContainer: {
      paddingHorizontal: 20,
      marginBottom: 25,
  },
  progressLabel: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
  },
  progressPercentage: {
    textAlign: 'right',
    fontSize: 14,
    color: '#333',
    marginTop: 5, 
  },
  weekSection: {
    marginHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  weekHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
  },
  weekTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    flexShrink: 1, 
  },
   tick: {
      fontSize: 24,
      color: '#4CAF50',
      fontWeight: 'bold',
      marginLeft: 10,
  },
  taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
  },
  checkbox: {
      width: 22,
      height: 22,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: '#aaa',
      marginRight: 12,
      justifyContent: 'center',
      alignItems: 'center',
  },
  checkboxInner: {
      width: 12,
      height: 12,
      backgroundColor: '#4CAF50',
      borderRadius: 2,
  },
  taskText: {
      fontSize: 16,
      color: '#444',
      flex: 1, 
  },
  taskTextCompleted: {
      textDecorationLine: 'line-through',
      color: '#aaa',
  },
  noTasksText: {
      color: '#888',
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 15,
  },
  addTaskContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      borderTopWidth: 1,
      borderTopColor: '#eee',
      paddingTop: 15,
  },
  taskInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ccc',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 5,
      marginRight: 10,
      backgroundColor: '#fff',
      fontSize: 15,
  },
  addButton: {
      backgroundColor: '#f4511e',
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 5,
      justifyContent: 'center',
      alignItems: 'center',
  },
  addButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
  }
});

export default GoalDetailScreen; 