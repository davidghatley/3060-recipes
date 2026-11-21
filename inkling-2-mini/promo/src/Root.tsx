import React from 'react';
import {Composition, Still} from 'remotion';
import {FPS, FRAMES, InklingDark, InklingLight} from './Inkling';
import {EX_FPS, EX_FRAMES, ExplainerDark, ExplainerLight} from './Explainer';
import {HeaderDark, HeaderLight, SocialDark, SocialLight, SquareDark, SquareLight} from './Stills';

export const Root: React.FC = () => (
  <>
    <Composition id="InklingLight" component={InklingLight} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="InklingDark" component={InklingDark} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="InklingLightV" component={InklingLight} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="ExplainerLight" component={ExplainerLight} durationInFrames={EX_FRAMES} fps={EX_FPS} width={1920} height={1080} />
    <Composition id="ExplainerDark" component={ExplainerDark} durationInFrames={EX_FRAMES} fps={EX_FPS} width={1920} height={1080} />
    <Still id="HeaderLight" component={HeaderLight} width={1280} height={320} />
    <Still id="HeaderDark" component={HeaderDark} width={1280} height={320} />
    <Still id="SocialLight" component={SocialLight} width={1200} height={675} />
    <Still id="SocialDark" component={SocialDark} width={1200} height={675} />
    <Still id="SquareLight" component={SquareLight} width={1080} height={1080} />
    <Still id="SquareDark" component={SquareDark} width={1080} height={1080} />
  </>
);
