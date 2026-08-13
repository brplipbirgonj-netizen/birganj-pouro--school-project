"use client"

import * as React from "react"
import { format } from "date-fns"
import { bn } from 'date-fns/locale'
import { Calendar as CalendarIcon } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "./scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  triggerClassName?: string;
  placeholder?: string;
}

export function DatePicker({ value, onChange, triggerClassName, placeholder = "" }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value)
  const [displayMonth, setDisplayMonth] = React.useState<Date>(value || new Date());
  const [view, setView] = React.useState<'days' | 'months' | 'years'>('days');

  const startYear = 1950;
  const endYear = new Date().getFullYear() + 5;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => endYear - i);
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(displayMonth);
    monthDate.setMonth(i);
    return format(monthDate, "MMMM", { locale: bn });
  });


  React.useEffect(() => {
    setSelectedDate(value)
    if(value) setDisplayMonth(value)
  }, [value])
  
  React.useEffect(() => {
    if (open) {
      setSelectedDate(value)
      setDisplayMonth(value || new Date())
      setView('days');
    }
  }, [open, value])

  const handleSet = () => {
    onChange(selectedDate);
    setOpen(false);
  }
  
  const handleCancel = () => {
    setOpen(false);
  }

  const handleClear = () => {
    onChange(undefined);
    setOpen(false);
  }

  const headerDate = selectedDate || displayMonth;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            triggerClassName
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP", { locale: bn }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 shadow-2xl">
        <div className="bg-primary text-primary-foreground p-2 rounded-t-lg">
          <div 
            className="text-[10px] cursor-pointer hover:underline opacity-80"
            onClick={() => setView(view === 'years' ? 'days' : 'years')}
          >
            {format(headerDate, "yyyy", { locale: bn })}
          </div>
          <div 
            className="text-lg font-bold cursor-pointer hover:underline"
            onClick={() => setView(view === 'months' ? 'days' : 'months')}
          >
            {format(headerDate, "eeee, d MMMM", { locale: bn })}
          </div>
        </div>
        <div className="p-1.5">
          {view === 'days' ? (
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={displayMonth}
                onMonthChange={setDisplayMonth}
                locale={bn}
                captionLayout="dropdown"
                fromYear={startYear}
                toYear={endYear}
                classNames={{
                    caption: "flex items-center justify-center relative pt-1",
                    caption_label: "hidden",
                    caption_dropdowns: "flex gap-2 w-full justify-center",
                    dropdown_month: "relative w-full",
                    dropdown_year: "relative w-full",
                    dropdown: "appearance-none w-full bg-background border border-input rounded-md px-3 py-1 text-xs",
                    vhidden: "hidden",
                    nav: "space-x-1 flex items-center",
                    nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-0.5 mt-2",
                    head_row: "flex",
                    head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]",
                    row: "flex w-full mt-1",
                    cell: "h-8 w-8 text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
                    day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                    day_selected: "bg-primary text-primary-foreground rounded-full hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground rounded-full",
                    day_outside: "text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_hidden: "invisible",
                }}
                components={{
                    Dropdown: ({ value, onChange, options }: { value?: string | number; onChange?: React.ChangeEventHandler<HTMLSelectElement>; options?: { value: string | number; label: string }[] }) => {
                    const handleChange = (newValue: string) => {
                        const event = {
                        target: { value: newValue },
                        } as React.ChangeEvent<HTMLSelectElement>;
                        onChange?.(event);
                    };
                    return (
                        <Select
                        value={value?.toString()}
                        onValueChange={(newValue) => handleChange(newValue)}
                        >
                        <SelectTrigger className="h-8 text-xs truncate">{options?.find(o => o.value?.toString() === value?.toString())?.label ?? value}</SelectTrigger>
                        <SelectContent>
                            <ScrollArea className="h-40">
                            {options?.map((option, i) => (
                                <SelectItem
                                key={`${option.value}-${i}`}
                                value={option.value?.toString() ?? ""}
                                >
                                {option.label}
                                </SelectItem>
                            ))}
                            </ScrollArea>
                        </SelectContent>
                        </Select>
                    );
                    },
                }}
              />
            ) : view === 'months' ? (
              <ScrollArea className="h-[160px]">
                <div className="grid grid-cols-3 gap-1">
                  {months.map((monthName, index) => (
                    <Button
                      key={monthName}
                      variant={displayMonth.getMonth() === index ? "default" : "ghost"}
                      className="w-full h-8 text-xs"
                      onClick={() => {
                        const newDate = new Date(displayMonth);
                        newDate.setMonth(index);
                        setDisplayMonth(newDate);
                        setView('days');
                      }}
                    >
                      {monthName}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="h-[160px]">
                <div className="grid grid-cols-3 gap-1">
                  {years.map((year) => (
                    <Button
                      key={year}
                      variant={displayMonth.getFullYear() === year ? "default" : "ghost"}
                      className="w-full h-8 text-xs"
                      onClick={() => {
                        const newDate = new Date(displayMonth);
                        newDate.setFullYear(year);
                        setDisplayMonth(newDate);
                        setView('days');
                      }}
                    >
                      {year.toLocaleString('bn-BD')}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            )
          }
        </div>
        <div className="flex justify-end gap-2 p-2 border-t">
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={handleClear}>মুছুন</Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={handleCancel}>বাতিল</Button>
          <Button size="sm" className="h-7 text-[10px] px-4" onClick={handleSet}>সেট</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
