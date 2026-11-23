import React from 'react';
import {Composition, Still} from 'remotion';
import {FPS, FRAMES, NbDark, NbLight} from './Plates';
import {FlagsDark, FlagsLight, PosterDark, PosterLight, ResultsDark, ResultsLight} from './Stills';

export const Root: React.FC = () => (
  <>
    <Composition id="NbLight" component={NbLight} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="NbDark" component={NbDark} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="NbLightV" component={NbLight} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="NbDarkV" component={NbDark} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Still id="ResultsLight" component={ResultsLight} width={1600} height={900} />
    <Still id="ResultsDark" component={ResultsDark} width={1600} height={900} />
    <Still id="FlagsLight" component={FlagsLight} width={1600} height={900} />
    <Still id="FlagsDark" component={FlagsDark} width={1600} height={900} />
    <Still id="PosterLight" component={PosterLight} width={1080} height={1350} />
    <Still id="PosterDark" component={PosterDark} width={1080} height={1350} />
  </>
);
