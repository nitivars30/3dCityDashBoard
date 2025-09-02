import { UserProject, BuildingFilter } from '@/types/city';

// Local storage keys
const PROJECTS_KEY = 'urban_dashboard_projects';
const USERS_KEY = 'urban_dashboard_users';

// Project management service using localStorage
// In a real application, this would use a backend database

export const saveProject = (
  username: string,
  name: string,
  filters: BuildingFilter[],
  description?: string
): UserProject => {
  const projects = getProjects();
  
  const newProject: UserProject = {
    id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    username,
    filters: [...filters],
    description,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Remove any existing project with the same name for this user
  const filteredProjects = projects.filter(
    p => !(p.username === username && p.name === name)
  );
  
  const updatedProjects = [...filteredProjects, newProject];
  
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
    console.log('Project saved successfully:', newProject);
    return newProject;
  } catch (error) {
    console.error('Failed to save project:', error);
    throw new Error('Failed to save project');
  }
};

export const getProjects = (): UserProject[] => {
  try {
    const projectsData = localStorage.getItem(PROJECTS_KEY);
    if (!projectsData) return [];
    
    const projects = JSON.parse(projectsData);
    
    // Convert date strings back to Date objects
    return projects.map((project: any) => ({
      ...project,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt)
    }));
  } catch (error) {
    console.error('Failed to get projects:', error);
    return [];
  }
};

export const getUserProjects = (username: string): UserProject[] => {
  const allProjects = getProjects();
  return allProjects
    .filter(project => project.username === username)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

export const deleteProject = (projectId: string): boolean => {
  try {
    const projects = getProjects();
    const filteredProjects = projects.filter(p => p.id !== projectId);
    
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(filteredProjects));
    console.log('Project deleted successfully:', projectId);
    return true;
  } catch (error) {
    console.error('Failed to delete project:', error);
    return false;
  }
};

export const updateProject = (
  projectId: string,
  updates: Partial<Omit<UserProject, 'id' | 'username' | 'createdAt'>>
): UserProject | null => {
  try {
    const projects = getProjects();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) {
      return null;
    }
    
    const updatedProject = {
      ...projects[projectIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    projects[projectIndex] = updatedProject;
    
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    console.log('Project updated successfully:', updatedProject);
    return updatedProject;
  } catch (error) {
    console.error('Failed to update project:', error);
    return null;
  }
};

export const getProject = (projectId: string): UserProject | null => {
  const projects = getProjects();
  return projects.find(p => p.id === projectId) || null;
};

// User management helpers
export const saveUserPreferences = (username: string, preferences: any): void => {
  try {
    const users = getUserPreferences();
    users[username] = {
      ...users[username],
      ...preferences,
      lastActive: new Date().toISOString()
    };
    
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Failed to save user preferences:', error);
  }
};

export const getUserPreferences = (): Record<string, any> => {
  try {
    const userData = localStorage.getItem(USERS_KEY);
    return userData ? JSON.parse(userData) : {};
  } catch (error) {
    console.error('Failed to get user preferences:', error);
    return {};
  }
};

// Export/Import functionality
export const exportProjects = (username: string): string => {
  const userProjects = getUserProjects(username);
  const exportData = {
    username,
    projects: userProjects,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  return JSON.stringify(exportData, null, 2);
};

export const importProjects = (jsonData: string): { success: boolean; imported: number; errors: string[] } => {
  try {
    const importData = JSON.parse(jsonData);
    const errors: string[] = [];
    let imported = 0;
    
    if (!importData.projects || !Array.isArray(importData.projects)) {
      return { success: false, imported: 0, errors: ['Invalid import format'] };
    }
    
    const existingProjects = getProjects();
    
    for (const projectData of importData.projects) {
      try {
        // Validate project structure
        if (!projectData.name || !projectData.username || !projectData.filters) {
          errors.push(`Invalid project data for ${projectData.name || 'unnamed project'}`);
          continue;
        }
        
        // Create new project with updated timestamps and ID
        const newProject: UserProject = {
          ...projectData,
          id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(projectData.createdAt || new Date()),
          updatedAt: new Date()
        };
        
        existingProjects.push(newProject);
        imported++;
      } catch (error) {
        errors.push(`Failed to import project ${projectData.name}: ${error}`);
      }
    }
    
    if (imported > 0) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(existingProjects));
    }
    
    return { success: imported > 0, imported, errors };
  } catch (error) {
    return { success: false, imported: 0, errors: [`Import failed: ${error}`] };
  }
};

// Statistics and analytics
export const getProjectStats = (username?: string) => {
  const projects = username ? getUserProjects(username) : getProjects();
  
  if (projects.length === 0) {
    return {
      totalProjects: 0,
      totalFilters: 0,
      averageFiltersPerProject: 0,
      mostUsedAttribute: null,
      recentActivity: null
    };
  }
  
  const totalFilters = projects.reduce((sum, p) => sum + p.filters.length, 0);
  const averageFiltersPerProject = totalFilters / projects.length;
  
  // Count filter attribute usage
  const attributeCount: Record<string, number> = {};
  projects.forEach(project => {
    project.filters.forEach(filter => {
      attributeCount[filter.attribute] = (attributeCount[filter.attribute] || 0) + 1;
    });
  });
  
  const mostUsedAttribute = Object.keys(attributeCount).reduce((a, b) => 
    attributeCount[a] > attributeCount[b] ? a : b, '');
  
  const recentActivity = projects
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  
  return {
    totalProjects: projects.length,
    totalFilters,
    averageFiltersPerProject: Math.round(averageFiltersPerProject * 10) / 10,
    mostUsedAttribute: attributeCount[mostUsedAttribute] ? mostUsedAttribute : null,
    recentActivity
  };
};