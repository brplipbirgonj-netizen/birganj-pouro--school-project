'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';

const ACADEMIC_YEAR_STORAGE_KEY = 'selectedAcademicYear';

type AcademicYearContextType = {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
};

const AcademicYearContext = createContext<AcademicYearContextType | undefined>(undefined);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYearState] = useState<string>(() => new Date().getFullYear().toString());

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(ACADEMIC_YEAR_STORAGE_KEY);
      if (item) {
        setSelectedYearState(item);
      }
    } catch (error) {
      console.log('Failed to read academic year from localStorage');
    }
  }, []);
  
  const availableYears = useMemo(() => {
    const startYear = 2020;
    const endYear = 2050;
    const years: string[] = [];
    for (let year = endYear; year >= startYear; year--) {
      years.push(String(year));
    }
    return years;
  }, []);

  const setSelectedYear = (year: string) => {
    try {
      window.localStorage.setItem(ACADEMIC_YEAR_STORAGE_KEY, year);
      setSelectedYearState(year);
    } catch (error) {
      console.log('Failed to save academic year to localStorage');
    }
  }
  
  const value = useMemo(() => ({
    selectedYear,
    setSelectedYear,
    availableYears,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [selectedYear, availableYears]);

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const context = useContext(AcademicYearContext);
  if (context === undefined) {
    throw new Error('useAcademicYear must be used within an AcademicYearProvider');
  }
  return context;
}
