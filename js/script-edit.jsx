import React from 'react'
import ReactDOM from 'react-dom'
import { Component } from 'react'
import _ from 'lodash'

export default class Container extends Component {
    constructor (props) {
        super(props)
        this.state = {
            openDropdownId: null
        }
    }

    closeParameterTypeDropdown () {
        this.setState({
            openDropdownId: null
        })
    }

    openParameterTypeDropdown (parameterId, event) {
        this.setState({
            openDropdownId: parameterId
        })
        event.stopPropagation()
    }

    handleWorkingDirectoryFileDrop (event) {
        const value = event.dataTransfer.files[0].path
        this.props.updateScript(this.props.id, 'workingDirectory', value)
    }

    updateCommand (event) {
        // Split the command on spaces that aren't inside quotes
        let extraSpace = event.target.value[event.target.value.length - 1] === ' '
        this.props.updateScript(this.props.id, 'command', event.target.value.match(/(?:[^\s"]+|"[^"]*")+/g).concat(extraSpace ? [' '] : []))
    }

    scriptInputChange (key, event) {
        this.props.updateScript(this.props.id, key, event.target.value)
    }

    parameterInputChange (parameterId, key, event) {
        this.props.updateParameter(parameterId, key, event.target.value)
    }

    setParameterType (parameterId, type, event) {
        this.props.updateParameter(parameterId, 'type', type)
        this.closeParameterTypeDropdown()
        event.stopPropagation()
    }

    componentDidMount() {
        this.boundCloseDropdown = this.closeParameterTypeDropdown.bind(this)
        document.body.addEventListener('click', this.boundCloseDropdown)
    }

    componentWillUnmount() {
        document.body.removeEventListener('click', this.boundCloseDropdown)
    }

    render () {
        const itemParameters = this.props.parameters.map((parameter, index) => {
            const dropdownOpen = this.state.openDropdownId === parameter.id
            return (
                <div className='parameter' key={index}>
                    <div className='edit-parameter-name-outer'>
                        <input type='text' className='edit-parameter-name' value={parameter.parameter} onChange={this.parameterInputChange.bind(this, parameter.id, 'parameter')} placeholder={'Enter a parameter e.g --output-file'} />
                        <i className='lnr lnr-cross-circle' onClick={this.props.deleteParameter.bind(null, parameter.id)} />
                    </div>
                    <div className={'edit-parameter-type dropdown' + (dropdownOpen ? ' active' : '')} onClick={this.openParameterTypeDropdown.bind(this, parameter.id)}>
                        <div className='type-selected'>
                            <div className='text'>{dropdownOpen ? 'Select Type' : _.capitalize(parameter.type)}</div><i className='lnr lnr-chevron-down' />
                        </div>
                        <div className='dropdown-inner'>
                            <div className={'item' + (parameter.type === 'text' ? ' selected' : '')} onClick={this.setParameterType.bind(this, parameter.id, 'text')}>Text</div>
                            <div className={'item' + (parameter.type === 'file' ? ' selected' : '')} onClick={this.setParameterType.bind(this, parameter.id, 'file')}>File</div>
                            <div className={'item' + (parameter.type === 'directory' ? ' selected' : '')} onClick={this.setParameterType.bind(this, parameter.id, 'directory')}>Directory / Folder</div>
                        </div>
                    </div>
                </div>
            )
        })

        return (
            <div className='panel'>
                <div className='header'><input type='text' value={this.props.title} onChange={this.scriptInputChange.bind(this, 'title')}/></div>
                <div className='panel-inner'>
                    <div className='description'>
                        <div className='title'>Description</div>
                        <div className='body'>
                            <textarea placeholder={'Type a description for this script'} value={this.props.description} onChange={this.scriptInputChange.bind(this, 'description')}/>
                        </div>
                    </div>
                    <div className='working-directory'>
                        <div className='title'>Working Directory</div>
                        <div className='body'>
                            <input type='text' className='edit-working-directory' value={this.props.workingDirectory} onChange={this.scriptInputChange.bind(this, 'workingDirectory')} onDrop={this.handleWorkingDirectoryFileDrop.bind(this)} />
                            <div className='file-select' onClick={this.props.openFileForScriptDialog.bind(null, this.props.id, 'workingDirectory', ['openDirectory'])}>
                                <i className='lnr lnr-enter'></i>
                                Select Directory
                            </div>
                        </div>
                    </div>
                    <div className='command-string'>
                        <div className='title'>Command to run</div>
                        <input type='text' className='edit-command-string-input' value={this.props.command.join(' ')} onChange={this.updateCommand.bind(this)}></input>
                    </div>
                    <div className='command-parameters'>
                        <div className='title'>Parameters</div>
                        {itemParameters}
                        <div className='add-parameter' onClick={this.props.addParameter.bind(null, this.props.id)}><i className='lnr lnr-plus-circle' />Add Parameter</div>
                    </div>
                    <div className='command-actions'>
                        <div className='save' onClick={this.props.cancelEditing.bind(null, this.props.id)}>
                            <span className="lnr lnr-checkmark-circle"></span>
                            Save
                        </div>
                        <div className='cancel' onClick={this.props.saveEditing.bind(null, this.props.id)}>
                            <span className="lnr lnr-cross-circle"></span>
                            Cancel
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}