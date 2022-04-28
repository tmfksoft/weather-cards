import SunCalc from 'suncalc';

interface MoonIlluminationResult extends SunCalc.GetMoonIlluminationResult {
    phaseName: string,
}
export default MoonIlluminationResult;