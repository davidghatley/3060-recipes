import React from 'react';
import {Composition} from 'remotion';
import {FPS, RaceDark, RaceLight, TOTAL} from './Race';

const N = TOTAL * FPS;
export const Root: React.FC = () => (
  <>
    <Composition id="RaceLight" component={RaceLight} durationInFrames={N} fps={FPS} width={1920} height={1080} />
    <Composition id="RaceLightV" component={RaceLight} durationInFrames={N} fps={FPS} width={1080} height={1920} />
    <Composition id="RaceDark" component={RaceDark} durationInFrames={N} fps={FPS} width={1920} height={1080} />
    <Composition id="RaceDarkV" component={RaceDark} durationInFrames={N} fps={FPS} width={1080} height={1920} />
  </>
);
