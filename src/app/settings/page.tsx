"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"

export default function SettingsPage() {
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
              <RadioGroup defaultValue="first-person" className="flex gap-4">
                <div>
                  <RadioGroupItem value="first-person" id="first-person" />
                  <Label htmlFor="first-person" className="ml-2">First-Person</Label>
                </div>
                <div>
                  <RadioGroupItem value="third-person" id="third-person" disabled />
                  <Label htmlFor="third-person" className="ml-2">Third-Person (Coming Soon)</Label>
                </div>
                <div>
                  <RadioGroupItem value="top-down" id="top-down" disabled />
                  <Label htmlFor="top-down" className="ml-2">Top-Down (Coming Soon)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="camera-shake" defaultChecked />
              <Label htmlFor="camera-shake">Camera Shake</Label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-primary">Audio</h3>
            <div className="space-y-2">
              <Label htmlFor="master-volume">Master Volume</Label>
              <Slider id="master-volume" defaultValue={[80]} max={100} step={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="music-volume">Music Volume</Label>
              <Slider id="music-volume" defaultValue={[50]} max={100} step={1} />
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
