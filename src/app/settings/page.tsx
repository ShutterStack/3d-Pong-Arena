"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

const defaultSettings = {
  cameraView: "first-person",
  cameraShake: true,
  masterVolume: 80,
  musicVolume: 50,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('pongSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error("Could not load settings, using defaults.", error);
      setSettings(defaultSettings);
    }
  }, []);

  const handleSettingChange = (key: keyof typeof defaultSettings, value: any) => {
    setSettings(prevSettings => {
      const newSettings = { ...prevSettings, [key]: value };
      try {
        localStorage.setItem('pongSettings', JSON.stringify(newSettings));
      } catch (error) {
          console.error("Could not save settings.", error);
      }
      return newSettings;
    });
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Adjust your game experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary">Camera</h3>
            <div className="space-y-2">
              <Label>Camera View</Label>
              <RadioGroup 
                value={settings.cameraView} 
                onValueChange={(value) => handleSettingChange('cameraView', value)}
                className="flex gap-4"
              >
                <div>
                  <RadioGroupItem value="first-person" id="first-person" />
                  <Label htmlFor="first-person" className="ml-2">First-Person</Label>
                </div>
                <div>
                  <RadioGroupItem value="third-person" id="third-person" />
                  <Label htmlFor="third-person" className="ml-2">Third-Person</Label>
                </div>
                <div>
                  <RadioGroupItem value="top-down" id="top-down" />
                  <Label htmlFor="top-down" className="ml-2">Top-Down</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="camera-shake" 
                checked={settings.cameraShake}
                onCheckedChange={(checked) => handleSettingChange('cameraShake', checked)}
              />
              <Label htmlFor="camera-shake">Camera Shake</Label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary">Audio</h3>
            <div className="space-y-2">
              <Label htmlFor="master-volume">Master Volume</Label>
              <Slider 
                id="master-volume" 
                value={[settings.masterVolume]}
                onValueChange={([value]) => handleSettingChange('masterVolume', value)} 
                max={100} 
                step={1} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-volume">Music Volume</Label>
              <Slider 
                id="music-volume" 
                value={[settings.musicVolume]} 
                onValueChange={([value]) => handleSettingChange('musicVolume', value)}
                max={100} 
                step={1} 
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary">Difficulty</h3>
            <div className="flex items-center space-x-2">
              <Switch id="dynamic-difficulty" defaultChecked disabled />
              <Label htmlFor="dynamic-difficulty">Dynamic Difficulty (AI-Powered)</Label>
            </div>
             <p className="text-sm text-muted-foreground">
                The AI will adjust difficulty based on your performance to keep the game challenging.
              </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
