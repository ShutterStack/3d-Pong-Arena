
"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

const defaultCustomization = {
  paddleColor: "#7DF9FF", // Electric Blue
  ballColor: "#FFFFFF", // White
};

const colorOptions = [
    { name: "Electric Blue", value: "#7DF9FF" },
    { name: "Neon Purple", value: "#D400FF" },
    { name: "Lime Green", value: "#39FF14" },
    { name: "Crimson Red", value: "#DC143C" },
    { name: "Solar Orange", value: "#FF5733" },
    { name: "Pure White", value: "#FFFFFF" },
]

export default function CustomizePage() {
  const [customization, setCustomization] = useState(defaultCustomization);

  useEffect(() => {
    try {
      const savedCustomization = localStorage.getItem('pongCustomization');
      if (savedCustomization) {
        setCustomization(JSON.parse(savedCustomization));
      }
    } catch (error) {
      console.error("Could not load customization, using defaults.", error);
      setCustomization(defaultCustomization);
    }
  }, []);

  const handleCustomizationChange = (key: keyof typeof defaultCustomization, value: any) => {
    setCustomization(prev => {
      const newCustomization = { ...prev, [key]: value };
      try {
        localStorage.setItem('pongCustomization', JSON.stringify(newCustomization));
      } catch (error) {
          console.error("Could not save customization.", error);
      }
      return newCustomization;
    });
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Customize</CardTitle>
          <CardDescription>Personalize your game assets.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary">Player Paddle Color</h3>
            <RadioGroup 
              value={customization.paddleColor} 
              onValueChange={(value) => handleCustomizationChange('paddleColor', value)}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {colorOptions.map(color => (
                <div key={`paddle-${color.value}`}>
                  <RadioGroupItem value={color.value} id={`paddle-${color.value}`} className="sr-only" />
                  <Label htmlFor={`paddle-${color.value}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:ring-2 [&:has([data-state=checked])]:ring-primary">
                     <div className="h-8 w-16 rounded-sm mb-2" style={{ backgroundColor: color.value }} />
                    {color.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary">Ball Color</h3>
             <RadioGroup 
              value={customization.ballColor} 
              onValueChange={(value) => handleCustomizationChange('ballColor', value)}
              className="grid grid-cols-2 md:grid-cols-3 gap-4"
            >
              {colorOptions.map(color => (
                <div key={`ball-${color.value}`}>
                  <RadioGroupItem value={color.value} id={`ball-${color.value}`} className="sr-only" />
                  <Label htmlFor={`ball-${color.value}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:ring-2 [&:has([data-state=checked])]:ring-primary">
                     <div className="h-8 w-8 rounded-full mb-2" style={{ backgroundColor: color.value }} />
                    {color.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
