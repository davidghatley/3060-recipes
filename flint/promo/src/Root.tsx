import React from 'react';
import {Composition, Still} from 'remotion';
import {FlintLaunch, FRAMES, FPS} from './Flint';
import {ThreadResults, ThreadFlags} from './Cards';
import {FlintLedger, FlintPoster, FlintPosterDark} from './v3/Plates';
import {ThreadResults3, ThreadFlags3, ThreadResults3Dark, ThreadFlags3Dark} from './v3/Cards';

export const Root: React.FC = () => (
  <>
    <Composition id="FlintLaunch" component={FlintLaunch} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="FlintLaunchV" component={FlintLaunch} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Still id="ThreadResults" component={ThreadResults} width={1600} height={900} />
    <Still id="ThreadFlags" component={ThreadFlags} width={1600} height={900} />
    <Still id="ThreadResultsV" component={ThreadResults} width={1080} height={1440} />
    <Still id="ThreadFlagsV" component={ThreadFlags} width={1080} height={1440} />
    {/* v3: Stem 7 everywhere, oversize figures. A = Ledger, B = Poster. */}
    <Composition id="FlintV3Ledger" component={FlintLedger} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="FlintV3LedgerV" component={FlintLedger} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Composition id="FlintV3Poster" component={FlintPoster} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="FlintV3PosterV" component={FlintPoster} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Still id="ThreadResults3" component={ThreadResults3} width={1600} height={900} />
    <Still id="ThreadFlags3" component={ThreadFlags3} width={1600} height={900} />
    <Still id="ThreadResults3V" component={ThreadResults3} width={1080} height={1440} />
    <Still id="ThreadFlags3V" component={ThreadFlags3} width={1080} height={1440} />
    {/* v3 Poster and thread cards in the Night palette (secret-sauce dark tokens). */}
    <Composition id="FlintV3PosterDark" component={FlintPosterDark} durationInFrames={FRAMES} fps={FPS} width={1920} height={1080} />
    <Composition id="FlintV3PosterDarkV" component={FlintPosterDark} durationInFrames={FRAMES} fps={FPS} width={1080} height={1920} />
    <Still id="ThreadResults3Dark" component={ThreadResults3Dark} width={1600} height={900} />
    <Still id="ThreadFlags3Dark" component={ThreadFlags3Dark} width={1600} height={900} />
    <Still id="ThreadResults3DarkV" component={ThreadResults3Dark} width={1080} height={1440} />
    <Still id="ThreadFlags3DarkV" component={ThreadFlags3Dark} width={1080} height={1440} />
  </>
);
