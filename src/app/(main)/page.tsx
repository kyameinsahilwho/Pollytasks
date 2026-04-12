"use client";

import { useTaskQuest } from '@/context/task-quest-context';
import { TaskView } from '@/components/task-view';

export default function HomePage() {
  const {
    habits,
    tasks,
    addHabit,
    toggleHabitCompletion,
    updateHabit,
    deleteHabit,
    handleToggleTask,
    deleteTask,
    setTaskToEdit,
    addSubtask,
    toggleSubtaskCompletion,
    setCelebrating,
  } = useTaskQuest();

  return (
    <TaskView
      habits={habits}
      tasks={tasks}
      onAddHabit={addHabit}
      onToggleHabit={toggleHabitCompletion}
      onUpdateHabit={updateHabit}
      onDeleteHabit={deleteHabit}
      onToggleTask={handleToggleTask}
      onDeleteTask={deleteTask}
      onEditTask={setTaskToEdit}
      onAddSubtask={addSubtask}
      onToggleSubtask={toggleSubtaskCompletion}
      setCelebrating={setCelebrating}
    />
  );
}
